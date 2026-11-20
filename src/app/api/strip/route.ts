// A photo of the strip from the call screen's camera: read it, remember it for the
// agent, and have the agent say what it saw.
import { readStrip } from "@/lib/claude";
import { speak } from "@/lib/agora";
import { getLang } from "@/lib/languages";
import { getState, logActivity, updateState } from "@/lib/store";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { sid, image } = (await req.json()) as { sid?: string; image?: string };
  const s = sid ? await getState(sid) : null;
  if (!s) return Response.json({ error: "call not found" }, { status: 404 });
  const m = image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > 6_000_000) return Response.json({ error: "send a JPEG, PNG or WebP photo under 4 MB" }, { status: 400 });
  const reading = await readStrip(m[2], m[1] as "image/jpeg" | "image/png" | "image/webp");
  const lang = getLang(s.lang);
  const comp = reading.ingredients.map((i) => `${i.name} ${i.strength} ${i.unit}`).join(" + ");
  const summary = reading.readable
    ? `${reading.brand_name ?? "(brand not readable)"}: ${comp || "composition not readable"}; ${reading.form ?? "form?"}${reading.release && reading.release !== "normal" ? `, ${reading.release} release` : ""}; MRP ${reading.mrp_rupees ?? "?"} for ${reading.units_per_pack ?? "?"} units`
    : `not readable (${reading.notes ?? "blurry or composition hidden"})`;
  await updateState(s.sid, (x) => {
    x.strip = { at: Date.now(), summary };
    logActivity(x, reading.readable ? `Read the strip: ${summary}` : "Couldn't read the strip clearly");
  });
  if (s.agentId) {
    const line = reading.readable && comp
      ? `${lang.code === "en" ? "I can see" : ""} ${reading.brand_name ?? ""}: ${comp}${reading.mrp_rupees ? `, ${Math.round(reading.mrp_rupees)} ${lang.rupees} / ${reading.units_per_pack ?? "?"}` : ""}.`
      : lang.failure;
    await speak({ agentId: s.agentId, channel: s.channel, agentUid: s.agentUid }, line.trim()).catch((e) => console.error("speak failed", e));
  }
  return Response.json({ reading, summary });
}
