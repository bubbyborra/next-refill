// The model behind the voice agent: Claude through the Anthropic SDK, streamed, with a
// manual tool loop so every tool runs in our own code against the official list.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const MODEL = process.env.WD_MODEL || "claude-sonnet-5-5";

function modelParams(model: string): Record<string, unknown> {
  // A voice call can't wait on hidden reasoning. Haiku 5.5 can turn thinking off (at effort
  // high or below); Sonnet 5.5 turns it off with "between_tools"; Opus 5.5 can't, so it only
  // gets the lowest effort.
  const effort = process.env.WD_EFFORT || "low";
  if (model.startsWith("claude-haiku-5-5")) return { thinking: { type: "disabled" }, output_config: { effort } };
  if (model.startsWith("claude-sonnet-5-5")) return { thinking: { type: "between_tools" }, output_config: { effort } };
  return { output_config: { effort } };
}

export interface LoopHooks {
  onText: (delta: string) => void;
  onToolStart: () => void;
  runTool: (name: string, input: unknown) => Promise<{ content: string; isError?: boolean }>;
}

export async function runVoiceTurn(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  stateNote: string;
  tools: Anthropic.Tool[];
  hooks: LoopHooks;
  maxRounds?: number;
  model?: string;
}): Promise<{ rounds: number; stop: string | null }> {
  const messages: Anthropic.MessageParam[] = [...opts.messages];
  // Live call state goes in a mid-conversation system message after the caller's turn,
  // so the cached prefix (tools, instructions, history) stays the same.
  messages.push({ role: "system", content: opts.stateNote } as unknown as Anthropic.MessageParam);

  let rounds = 0;
  let stop: string | null = null;
  let lastChar = "";
  let roundStart = false;
  const emit = (d: string) => {
    // keep a space between text from different rounds ("…search. Both…")
    if (roundStart && lastChar && !/\s/.test(lastChar) && !/^\s/.test(d)) d = " " + d;
    roundStart = false;
    if (d) lastChar = d[d.length - 1];
    opts.hooks.onText(d);
  };
  let retries = 0;
  while (rounds < (opts.maxRounds ?? 5)) {
    rounds++;
    const stream = client.messages.stream({
      model: opts.model ?? MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      tools: opts.tools,
      messages,
      ...(modelParams(opts.model ?? MODEL) as Partial<Anthropic.MessageCreateParamsStreaming>),
    });
    roundStart = true;
    stream.on("text", (delta) => emit(delta));
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") opts.hooks.onToolStart();
    });

    const tRound = Date.now();
    if (process.env.DEBUG_TIMING) stream.on("streamEvent", (ev) => console.log(`  [r${rounds} +${Date.now() - tRound}ms] ${ev.type}${ev.type === "content_block_start" ? ":" + ev.content_block.type : ""}`));
    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
      if (process.env.DEBUG_TIMING) console.log(`  [r${rounds}] final after ${Date.now() - tRound}ms stop=${message.stop_reason} usage=${JSON.stringify(message.usage)}`);
      retries = 0;
    } catch (err) {
      if (err instanceof Anthropic.APIError || retries++ >= 1) throw err;
      rounds--;
      continue; // unparseable tool input or a dropped connection: re-issue the turn once
    }
    stop = message.stop_reason;
    if (stop === "end_turn" || stop === "refusal" || stop === "stop_sequence") break;
    if (stop === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) break;
    if (stop === "max_tokens") throw new Error("tool input truncated at max_tokens");

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      try {
        const tTool = Date.now();
        const r = await opts.hooks.runTool(tu.name, tu.input);
        if (process.env.DEBUG_TIMING) console.log(`  [tool ${tu.name}] ${Date.now() - tTool}ms`);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content, is_error: r.isError || undefined });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `error: ${(e as Error).message}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { rounds, stop };
}

// Reads a photo of a medicine strip: brand, composition, form, MRP and pack size.
export interface StripReading {
  readable: boolean;
  brand_name: string | null;
  ingredients: { name: string; strength: number; unit: string }[];
  form: string | null;
  release: string | null;
  mrp_rupees: number | null;
  units_per_pack: number | null;
  notes: string | null;
}

export async function readStrip(imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<StripReading> {
  const res = await client.messages.create({
    model: process.env.WD_VISION_MODEL || MODEL,
    max_tokens: 4000,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["readable", "brand_name", "ingredients", "form", "release", "mrp_rupees", "units_per_pack", "notes"],
          properties: {
            readable: { type: "boolean" },
            brand_name: { type: ["string", "null"] },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "strength", "unit"],
                properties: {
                  name: { type: "string" },
                  strength: { type: "number" },
                  unit: { type: "string", enum: ["mg", "mcg", "g", "iu", "%"] },
                },
              },
            },
            form: { type: "string", enum: ["tablet", "capsule", "syrup", "suspension", "injection", "cream", "gel", "ointment", "drops", "inhaler", "powder", "other", "unknown"] },
            release: { type: "string", enum: ["normal", "extended", "delayed", "dispersible", "unknown"] },
            mrp_rupees: { type: ["number", "null"] },
            units_per_pack: { type: ["number", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text:
              "This is a photo of an Indian medicine strip or box. Read only what is printed. Return the brand name, every active ingredient with its strength exactly as printed (the composition line, e.g. 'Each film-coated tablet contains Telmisartan IP 40 mg'), the dosage form, the release type (extended for SR/ER/XR/CR/PR/prolonged release, delayed for gastro-resistant/enteric coated/DR, dispersible for DT/ODT, otherwise normal), the printed MRP in rupees and how many units that MRP covers. Use null (or 'unknown' for form and release) for anything you cannot read clearly; never guess. readable=false if the composition is not legible.",
          },
        ],
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const r = JSON.parse(text) as StripReading;
  if (r.form === "unknown") r.form = null;
  if (r.release === "unknown") r.release = null;
  return r;
}

// A short voice note of the finished list, in the caller's language, for the phone page.
export async function writeVoiceNote(langName: string, details: string): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    ...(modelParams(MODEL) as Partial<Anthropic.MessageCreateParamsNonStreaming>),
    system:
      "You write short voice notes that a text-to-speech voice reads to an older person in India. Plain sentences only: no lists, symbols, emojis or markdown. Say rupee amounts as whole numbers followed by the word for rupees. Keep medicine names in English letters.",
    messages: [
      {
        role: "user",
        content: `Write the voice note in ${langName}, at most 70 words. For each medicine: what to ask for at the Jan Aushadhi store instead of the brand (the generic name and the drug code), then the total saving per month (once), the nearest store's street or area only if it is in the facts (otherwise don't mention stores), and a reminder to show the list to the pharmacist. Facts:\n${details}`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}
