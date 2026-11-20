// "Listen": the list as a short voice note in the caller's language, spoken by the same
// Murf Falcon voice as the call (Murf's streaming endpoint, MP3).
import { writeVoiceNote } from "@/lib/claude";
import { getLang } from "@/lib/languages";
import { getState, updateState } from "@/lib/store";
import { totals } from "@/lib/tools";

export async function GET(_req: Request, sid: string): Promise<Response> {
  const s = await getState(sid);
  if (!s || !s.meds.length) return new Response("No list yet", { status: 404 });
  const lang = getLang(s.lang);
  const t = totals(s);
  const details = [
    ...s.meds.map((m) =>
      m.ja
        ? `${m.brand}: ask for ${m.ja.name}, Jan Aushadhi drug code ${m.ja.code}${m.monthlySaving !== undefined ? `, saves ${Math.round(m.monthlySaving)} rupees a month` : ""}`
        : `${m.brand}: not on the Jan Aushadhi list, keep buying it`,
    ),
    t.pricedCount ? `Total saving: ${t.monthlySaving} rupees a month` : "",
    s.stores?.[0] ? `Nearest store: ${s.stores[0].address} (about ${s.stores[0].km} km)` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const key = `${lang.code}|${details}`;
  let text = s.voiceNote?.key === key ? s.voiceNote.text : "";
  if (!text) {
    text = await writeVoiceNote(lang.name, details);
    await updateState(sid, (x) => {
      x.voiceNote = { key, text };
    });
  }
  const murf = await fetch("https://api.murf.ai/v1/speech/stream", {
    method: "POST",
    headers: { "api-key": process.env.MURF_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId: lang.voiceId, locale: lang.murfLocale, model: process.env.MURF_MODEL || "FALCON", format: "MP3" }),
  });
  if (!murf.ok || !murf.body) return new Response(`Voice note failed (${murf.status})`, { status: 502 });
  return new Response(murf.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
