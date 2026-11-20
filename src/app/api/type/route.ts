// "Type instead": for a noisy room or no microphone. The typed line goes through the same
// model and tools as speech, and the agent says the reply on the call (speak API).
import type Anthropic from "@anthropic-ai/sdk";
import { runVoiceTurn } from "@/lib/claude";
import { speak } from "@/lib/agora";
import { getLang } from "@/lib/languages";
import { stateNote, systemPrompt } from "@/lib/prompt";
import { getState, logActivity, updateState } from "@/lib/store";
import { TOOLS, runTool } from "@/lib/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { sid, text } = (await req.json().catch(() => ({}))) as { sid?: string; text?: string };
  const s = sid ? await getState(sid) : null;
  if (!s) return Response.json({ error: "call not found" }, { status: 404 });
  const said = (text ?? "").trim().slice(0, 500);
  if (!said) return Response.json({ error: "type something first" }, { status: 400 });
  const lang = getLang(s.lang);

  const history: Anthropic.MessageParam[] = [{ role: "user", content: "(The call has connected.)" }, { role: "assistant", content: lang.greeting }];
  for (const t of s.typed ?? []) {
    history.push({ role: "user", content: t.user }, { role: "assistant", content: t.agent });
  }
  history.push({ role: "user", content: said });

  let reply = "";
  await runVoiceTurn({
    system: systemPrompt(lang),
    messages: history,
    stateNote: stateNote(s),
    tools: TOOLS,
    hooks: { onText: (d) => (reply += d), onToolStart: () => {}, runTool: (name, input) => runTool(s.sid, name, input) },
  });
  reply = reply.trim() || lang.failure;

  await updateState(s.sid, (x) => {
    x.typed = [...(x.typed ?? []), { user: said, agent: reply }].slice(-12);
    logActivity(x, `Typed: "${said.slice(0, 60)}"`);
  });

  if (s.agentId && !s.ended) {
    // The speak API takes up to 512 bytes, so long replies go out sentence by sentence.
    const parts = reply.match(/[^.!?।]+[.!?।]?/g) ?? [reply];
    let chunk = "";
    for (const p of parts) {
      if (new TextEncoder().encode(chunk + p).length > 480 && chunk) {
        await speak({ agentId: s.agentId, channel: s.channel, agentUid: s.agentUid }, chunk).catch((e) => console.error("speak failed", e));
        chunk = "";
      }
      chunk += p;
    }
    if (chunk.trim()) await speak({ agentId: s.agentId, channel: s.channel, agentUid: s.agentUid }, chunk).catch((e) => console.error("speak failed", e));
  }
  return Response.json({ reply });
}
