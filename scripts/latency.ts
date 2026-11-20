// Times one caller turn (first words and full reply) for a given Claude model, using the
// real prompt and tools on an in-memory call. Usage: npx tsx --env-file=.env.local scripts/latency.ts claude-haiku-5-5
import { runVoiceTurn } from "../src/lib/claude";
import { getLang } from "../src/lib/languages";
import { stateNote, systemPrompt } from "../src/lib/prompt";
import { putState, getState } from "../src/lib/store";
import { TOOLS, runTool } from "../src/lib/tools";

const model = process.argv[2] || "claude-opus-5-5";
const sid = "latency" + Math.random().toString(36).slice(2, 8);
const lang = getLang(process.argv[3] || "te");
const said = process.argv[4] || "మా నాన్నగారు Telma 40 రోజుకు ఒకటి వేసుకుంటారు. 30 టాబ్లెట్లు 230 రూపాయలు.";

async function main() {
  await putState({ sid, lang: lang.code, createdAt: Date.now(), channel: "x", userUid: 1, agentUid: 2, meds: [], activity: [] });
  const state = (await getState(sid))!;
  const t0 = Date.now();
  let first = -1;
  let out = "";
  let filler = -1;
  await runVoiceTurn({
    model,
    system: systemPrompt(lang),
    messages: [
      { role: "user", content: "(The call has connected.)" },
      { role: "assistant", content: lang.greeting },
      { role: "user", content: said },
    ],
    stateNote: stateNote(state),
    tools: TOOLS,
    hooks: {
      onText: (d) => {
        if (first < 0) first = Date.now() - t0;
        out += d;
      },
      onToolStart: () => {
        if (filler < 0) filler = Date.now() - t0;
      },
      runTool: (name, input) => runTool(sid, name, input),
    },
  });
  console.log(`${model}: tool call starts ${filler}ms, first spoken answer ${first}ms, done ${Date.now() - t0}ms`);
  console.log(out);
}
main();
