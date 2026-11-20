// Starts a call: a fresh channel, a token for the browser, and the Agora agent.
import { clientToken, startAgent, stopAgent } from "@/lib/agora";
import { getLang } from "@/lib/languages";
import { baseUrl, jsonError, newId } from "@/lib/http";
import { getState, logActivity, putState, updateState, type CallState } from "@/lib/store";
import { nearest } from "@/lib/stores";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { lang?: string; lat?: number; lon?: number };
  const lang = getLang(body.lang);
  const sid = newId();
  const channel = `dt-${sid}`;
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
    const agentId = await startAgent({ sid, lang, channel, userUid, agentUid, baseUrl: baseUrl(req) });
    await updateState(sid, (s) => {
      s.agentId = agentId;
    });
  } catch (e) {
    console.error("agent start failed", e);
    return jsonError(`Couldn't start the voice agent: ${(e as Error).message}`, 502);
  }
  return Response.json({
    sid,
    appId: process.env.AGORA_APP_ID,
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
  if (s.agentId && !s.ended) await stopAgent(s.agentId).catch((e) => console.error("stop failed", e));
  await updateState(sid, (x) => {
    x.ended = true;
    logActivity(x, "Call ended");
  });
  return Response.json({ ok: true });
}
