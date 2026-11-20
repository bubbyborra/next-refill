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
  const body = (await req.json().catch(() => ({}))) as { lang?: string; lat?: number; lon?: number };
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
  try {
    const opts = { sid, lang, channel, userUid, agentUid, baseUrl: baseUrl(req) };
    const agentId = await startAgent(opts);
    await updateState(sid, (s) => {
      s.agentId = agentId;
    });
    // Agora now and then fails an agent a second after a good start ("agent exits with reason:
    // RTC connection error"). After the response has gone, check it and start a fresh agent on
    // the same channel if it failed (twice at most); the caller only waits a little longer.
    after(async () => {
      let current = agentId;
      for (let attempt = 0; attempt < 2; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        if ((await agentStatus({ agentId: current, channel, agentUid })) !== "FAILED") return;
        console.warn(`[session ${sid}] agent ${current} failed after start; starting another`);
        try {
          current = await startAgent(opts);
          await updateState(sid, (s) => {
            s.agentId = current;
          });
        } catch (e) {
          console.error(`[session ${sid}] agent restart failed`, e);
          return;
        }
      }
    });
  } catch (e) {
    console.error("agent start failed", e);
    return jsonError(`Couldn't start the voice agent: ${(e as Error).message}`, 502);
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
