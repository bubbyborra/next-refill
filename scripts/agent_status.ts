// What Agora says about the agent of one call: its status, any error, and the turns it heard
// and spoke. For debugging a call that went quiet.
// Usage: npx tsx --env-file=.env.local scripts/agent_status.ts <sid>
//        npx tsx --env-file=.env.local scripts/agent_status.ts --recent   (every agent of the last 3 days)
//        npx tsx --env-file=.env.local scripts/agent_status.ts --start-test (start an agent from this
//          machine on a throwaway channel, watch its status for 10 s, stop it)
// Needs the Agora App ID and certificate. If the call's state isn't in this machine's store
// (the live site keeps it in its own Redis), the agent is found by the call's channel name.
// Prints no keys.
import { generateConvoAIToken } from "agora-agents";
import { agora, startAgent, stopAgent } from "../src/lib/agora";
import { getLang } from "../src/lib/languages";
import { getState } from "../src/lib/store";

async function main() {
  const sid = process.argv[2];
  if (sid === "--recent") return recent();
  if (sid === "--start-test") return startTest();
  if (!sid) {
    console.error("usage: npx tsx --env-file=.env.local scripts/agent_status.ts <sid>");
    process.exit(2);
  }
  const s = await getState(sid);
  const channel = s?.channel ?? `nr-${sid}`;
  const agentUid = s?.agentUid ?? 100;
  const appid = process.env.AGORA_APP_ID!;
  const token = generateConvoAIToken({ appId: appid, appCertificate: process.env.AGORA_APP_CERTIFICATE!, channelName: channel, uid: agentUid });
  const opts = { headers: { Authorization: `agora token=${token}` } };
  const client = agora();
  const show = async (label: string, fn: () => Promise<unknown>) => {
    try {
      const v = await fn();
      console.log(`\n== ${label}\n${JSON.stringify(v, null, 1).slice(0, 5000)}`);
      return v;
    } catch (e) {
      const err = e as { statusCode?: number; body?: unknown; message?: string };
      console.log(`\n== ${label}: failed ${err.statusCode ?? ""} ${JSON.stringify(err.body ?? err.message).slice(0, 600)}`);
      return null;
    }
  };

  let agentId = s?.agentId;
  if (!agentId) {
    const found = (await show(`agents on channel ${channel}`, async () => {
      // stopped (4) and failed (6) agents aren't listed unless asked for
      const items: unknown[] = [];
      for (const state of ["2", "4", "6"]) {
        const page = await client.agents.list({ appid, channel, state, from_time: Math.floor(Date.now() / 1000) - 86400, limit: 5 }, opts);
        for await (const it of page) items.push({ state, ...(it as object) });
      }
      return items;
    })) as { agent_id?: string }[] | null;
    agentId = found?.[0]?.agent_id;
  }
  console.log({ sid, channel, agentUid, agentId: agentId ?? "(not found)", stateFound: Boolean(s) });
  if (!agentId) return;
  await show("agent", () => client.agents.get({ appid, agentId }, opts));
  await show("history", () => client.agents.getHistory({ appid, agentId }, opts));
  await show("turns", () => client.agents.getTurns({ appid, agentId } as never, opts));
}

main();

// Every agent this project started in the last 3 days, with its status (running, stopped, failed).
async function recent() {
  const appid = process.env.AGORA_APP_ID!;
  const token = generateConvoAIToken({ appId: appid, appCertificate: process.env.AGORA_APP_CERTIFICATE!, channelName: "nr-list", uid: 100 });
  const opts = { headers: { Authorization: `agora token=${token}` } };
  const client = agora();
  for (const state of ["2", "4", "6"]) {
    try {
      const page = await client.agents.list({ appid, state, from_time: Math.floor(Date.now() / 1000) - 3 * 86400, limit: 50 }, opts);
      const rows: string[] = [];
      for await (const it of page as AsyncIterable<{ agent_id: string; start_ts: number; stop_ts?: number; status: string }>) {
        rows.push(`${new Date(it.start_ts * 1000).toISOString().slice(5, 19)}Z ${it.status} ${it.stop_ts ? `${it.stop_ts - it.start_ts}s` : "running"} ${JSON.stringify(it).slice(0, 200)}`);
        if (rows.length >= 60) break;
      }
      console.log(`state ${state}: ${rows.length}`);
      for (const r of rows) console.log("  " + r);
    } catch (e) {
      const err = e as { statusCode?: number; body?: unknown };
      console.log(`state ${state}: failed ${err.statusCode} ${JSON.stringify(err.body).slice(0, 300)}`);
    }
  }
}

async function startTest() {
  // --break=NAME appends a line break to that env value first, and --wrong=NAME replaces it
  // with a made-up value, to see how the agent fails when a key was saved wrongly.
  for (const a of process.argv.slice(3)) {
    const m = a.match(/^--break=([A-Z_]+)$/);
    if (m && process.env[m[1]]) {
      process.env[m[1]] += "\n";
      console.log(`(${m[1]} now ends with a line break)`);
    }
    const w = a.match(/^--wrong=([A-Z_]+)$/);
    if (w) {
      process.env[w[1]] = "not-a-real-key-0000000000000000";
      console.log(`(${w[1]} replaced with a made-up value)`);
    }
  }
  const appid = process.env.AGORA_APP_ID!;
  const sid = `t${Date.now().toString(36)}`;
  const channel = `nr-${sid}`;
  const agentUid = 100;
  const t0 = Date.now();
  const agentId = await startAgent({ sid, lang: getLang("te"), channel, userUid: 54321, agentUid, baseUrl: process.env.PUBLIC_BASE_URL || "https://next-refill.vercel.app" });
  console.log(`started ${agentId} on ${channel} in ${Date.now() - t0} ms`);
  const token = generateConvoAIToken({ appId: appid, appCertificate: process.env.AGORA_APP_CERTIFICATE!, channelName: channel, uid: agentUid });
  const opts = { headers: { Authorization: `agora token=${token}` } };
  // The list call (filtered by channel and state) works for running agents; get can refuse them.
  const statusOf = async () => {
    for (const state of ["2", "6", "4", "1"]) {
      const page = await agora().agents.list({ appid, channel, state, from_time: Math.floor(t0 / 1000) - 60, limit: 5 }, opts);
      for await (const it of page as AsyncIterable<{ agent_id: string; status: string }>) if (it.agent_id === agentId) return it.status;
    }
    return "not listed";
  };
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await statusOf().catch((e) => `status check failed: ${(e as Error).message}`);
    console.log(`  +${i + 1}s ${st}`);
    if (st === "FAILED" || st === "STOPPED") {
      const a = await agora().agents.get({ appid, agentId }, opts).catch(() => null);
      if (a) console.log(a);
      return;
    }
  }
  await stopAgent({ agentId, channel, agentUid }).catch((e) => console.log("stop failed", (e as Error).message));
  console.log("stopped");
}
