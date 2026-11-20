// Agora's agent calls this like an OpenAI chat-completions endpoint (streaming SSE).
// We answer with Claude, run the medicine tools in our own code, and stream the words back.
import { timingSafeEqual } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { runVoiceTurn } from "@/lib/claude";
import { envValue } from "@/lib/env";
import { getLang } from "@/lib/languages";
import { stateNote, systemPrompt } from "@/lib/prompt";
import { getState } from "@/lib/store";
import { TOOLS, runTool } from "@/lib/tools";

type InMsg = { role: string; content: string | { type?: string; text?: string }[] | null };

function toAnthropic(messages: InMsg[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p) => p.text ?? "").join(" ") : "";
    if (!text.trim()) continue;
    out.push({ role: m.role, content: text.trim().slice(0, 2000) });
  }
  if (out.length && out[0].role === "assistant") out.unshift({ role: "user", content: "(The call has connected.)" });
  if (!out.length || out[out.length - 1].role !== "user") out.push({ role: "user", content: "(The caller is silent.)" });
  return out;
}

// Only Agora's agent holds the key (it's set when the agent starts). No key, no access.
function authorized(req: Request): boolean {
  const key = envValue("LLM_ROUTE_KEY");
  if (!key) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${key}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const sid = new URL(req.url).searchParams.get("sid") || "";
  const state = await getState(sid);
  if (!state) return new Response("call not found", { status: 404 });
  const lang = getLang(state.lang);
  const body = (await req.json().catch(() => ({}))) as { messages?: InMsg[] };
  const history = toAnthropic(Array.isArray(body.messages) ? body.messages.slice(-40) : []);

  const enc = new TextEncoder();
  const id = `chatcmpl-${sid}-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
    enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "next-refill", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let spoke = false;
      let filled = false;
      const t0 = Date.now();
      try {
        await runVoiceTurn({
          system: systemPrompt(lang),
          messages: history,
          stateNote: stateNote(state),
          tools: TOOLS,
          hooks: {
            onText: (d) => {
              if (!spoke) console.log(`[llm ${sid}] first words after ${Date.now() - t0} ms`);
              spoke = true;
              controller.enqueue(chunk({ content: d }));
            },
            onToolStart: () => {
              if (!spoke && !filled) {
                filled = true;
                controller.enqueue(chunk({ content: `${lang.filler} ` }));
              }
            },
            runTool: (name, input) => runTool(sid, name, input),
          },
        });
      } catch (e) {
        console.error(`[llm ${sid}] turn failed`, e);
        if (!spoke) controller.enqueue(chunk({ content: lang.failure }));
      }
      controller.enqueue(chunk({}, "stop"));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
