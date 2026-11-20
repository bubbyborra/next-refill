// A photo of the strip from the call screen's camera: read it, remember it for the
// agent, and have the agent say what it saw.
import { readStrip } from "@/lib/claude";
import { speak } from "@/lib/agora";
import { getLang } from "@/lib/languages";
import { countHit, getState, logActivity, updateState } from "@/lib/store";

const MAX_BODY_BYTES = 4_400_000; // under the host's 4.5 MB request limit
const MAX_PHOTOS_PER_CALL = 6;

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES)
    return Response.json({ error: "send a JPEG, PNG or WebP photo under 3 MB" }, { status: 413 });
  const { sid, image } = (await req.json().catch(() => ({}))) as { sid?: string; image?: string };
  const s = typeof sid === "string" ? await getState(sid) : null;
  if (!s) return Response.json({ error: "call not found" }, { status: 404 });
  const m = typeof image === "string" ? image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m || m[2].length > MAX_BODY_BYTES) return Response.json({ error: "send a JPEG, PNG or WebP photo under 3 MB" }, { status: 400 });
  if ((await countHit(`strip:${s.sid}`, 86400)) > MAX_PHOTOS_PER_CALL)
    return Response.json({ error: "This call has reached its limit of strip photos. Start a new call." }, { status: 429 });
  let reading: Awaited<ReturnType<typeof readStrip>>;
  try {
    reading = await readStrip(m[2], m[1] as "image/jpeg" | "image/png" | "image/webp");
  } catch (e) {
    console.error("strip read failed", e);
    return Response.json({ error: "Couldn't read that photo. Try again with the strip flat and in good light." }, { status: 422 });
  }
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
