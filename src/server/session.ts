// Starts a call: a fresh channel, a token for the browser, and the Agora agent.
import { after } from "next/server";
import { agentStatus, clientToken, startAgent, stopAgent } from "@/lib/agora";
import { envValue } from "@/lib/env";
import { getLang } from "@/lib/languages";
import { baseUrl, jsonError, newId } from "@/lib/http";
import { countHit, getState, logActivity, putState, updateState, type CallState } from "@/lib/store";
import { nearest } from "@/lib/stores";

// Caps shared by every server instance, so a public link can't run up the Agora, speech and
// model bills: calls per network per hour (a venue's Wi-Fi is one network, so it's generous)
// and calls per day in total.
const PER_IP_HOUR = Number(process.env.MAX_CALLS_PER_HOUR || 60);
const PER_DAY = Number(process.env.MAX_CALLS_PER_DAY || 300);

function clientIp(req: Request): string {
  // On Vercel, x-real-ip and x-forwarded-for are set by the platform, not by the caller.
  return (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
}

export async function POST(req: Request) {
  if ((await countHit(`ip:${clientIp(req)}`, 3600)) > PER_IP_HOUR)
    return jsonError("Too many calls from this network in the last hour. Please try again later.", 429);
  if ((await countHit(`day:${new Date().toISOString().slice(0, 10)}`, 86400)) > PER_DAY)
    return jsonError("The demo has reached today's limit of calls. Please try again tomorrow.", 429);
  const body = (await req.json().catch(() => ({}))) as { lang?: string; lat?: number; lon?: number; agent?: string };
  const lang = getLang(body.lang);
  const sid = newId();
  const channel = `nr-${sid}`;
  const userUid = 10000 + Math.floor(Math.random() * 80000);
  const agentUid = 100;
  const state: CallState = { sid, lang: lang.code, createdAt: Date.now(), channel, userUid, agentUid, meds: [], activity: [] };
  if (typeof body.lat === "number" && typeof body.lon === "number" && Math.abs(body.lat) <= 90 && Math.abs(body.lon) <= 180) {
    state.location = { lat: body.lat, lon: body.lon, label: "your current location", source: "browser" };
    state.stores = nearest(state.location, 3);
  }
  logActivity(state, `Call started in ${lang.name}`);
  await putState(state);
  // The browser sends agent: "later" and starts the agent itself with POST /api/agent while it
  // joins the channel, which cuts a second or two before the greeting. Other callers get the
  // agent started here, as before.
  if (body.agent !== "later") {
    try {
      await startAgentFor(state, baseUrl(req));
    } catch (e) {
      console.error("agent start failed", e);
      return jsonError(`Couldn't start the voice agent: ${(e as Error).message}`, 502);
    }
  }
  return Response.json({
    sid,
    appId: envValue("AGORA_APP_ID"),
    channel,
    uid: userUid,
    agentUid,
    token: clientToken(channel, userUid),
  });
}

// Starts the call's agent once (a second request for the same call does nothing).
export async function START_AGENT(req: Request) {
  const { sid } = (await req.json().catch(() => ({}))) as { sid?: string };
  const s = typeof sid === "string" ? await getState(sid) : null;
  if (!s) return jsonError("call not found", 404);
  if (s.ended) return jsonError("this call has ended", 409);
  if (s.agentId || (await countHit(`agent:${s.sid}`, 3600)) > 1) return Response.json({ ok: true, already: true });
  try {
    await startAgentFor(s, baseUrl(req));
  } catch (e) {
    console.error("agent start failed", e);
    return jsonError(`Couldn't start the voice agent: ${(e as Error).message}`, 502);
  }
  return Response.json({ ok: true });
}

async function startAgentFor(s: CallState, base: string): Promise<void> {
  const { sid, channel, userUid, agentUid } = s;
  const opts = { sid, lang: getLang(s.lang), channel, userUid, agentUid, baseUrl: base };
  const agentId = await startAgent(opts);
  const after1 = await updateState(sid, (x) => {
    x.agentId = agentId;
  });
  // Ended while the agent was starting: stop it again.
  if (after1.ended) {
    await stopAgent({ agentId, channel, agentUid }).catch((e) => console.error("stop failed", e));
    return;
  }
  // Agora now and then fails an agent a second or more after a good start ("agent exits with
  // reason: RTC connection error"). After the response has gone, watch the agent for about 9 s
  // and start a fresh one on the same channel if it fails (twice at most).
  after(async () => {
    let current = agentId;
    let restarts = 0;
    let since = Date.now();
    while (Date.now() - since < 9000) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await agentStatus({ agentId: current, channel, agentUid });
      if (st !== "FAILED") {
        if (st === null) console.warn(`[session ${sid}] agent ${current} status unknown`);
        continue;
      }
      const now = await getState(sid);
      if (!now || now.ended || restarts >= 2) {
        console.warn(`[session ${sid}] agent ${current} failed; not restarting (ended or out of retries)`);
        return;
      }
      restarts++;
      console.warn(`[session ${sid}] agent ${current} failed after start; starting another (${restarts})`);
      try {
        current = await startAgent(opts);
        since = Date.now();
        await updateState(sid, (x) => {
          x.agentId = current;
        });
      } catch (e) {
        console.error(`[session ${sid}] agent restart failed`, e);
        return;
      }
    }
  });
}

export async function DELETE(req: Request) {
  const sid = new URL(req.url).searchParams.get("sid") || "";
  const s = await getState(sid);
  if (!s) return jsonError("call not found", 404);
  if (s.agentId && !s.ended) await stopAgent({ agentId: s.agentId, channel: s.channel, agentUid: s.agentUid }).catch((e) => console.error("stop failed", e));
  await updateState(sid, (x) => {
    x.ended = true;
    logActivity(x, "Call ended");
  });
  return Response.json({ ok: true });
}
