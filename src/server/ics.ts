// Monthly refill reminders as a calendar file the phone can add in one tap.
import { getState } from "@/lib/store";
import { PRODUCT } from "@/lib/brand";


const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

export async function GET(_req: Request, sid: string) {
  const s = await getState(sid);
  if (!s?.sent) return new Response("No reminders on this list yet", { status: 404 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = s.sent.reminders.map((r) => {
    const med = s.meds.find((m) => m.id === r.medId);
    const day = r.date.replace(/-/g, "");
    const what = med?.ja ? `Buy ${med.ja.name} (Jan Aushadhi code ${med.ja.code}) instead of ${med.brand}` : `Refill ${r.brand}`;
    return [
      "BEGIN:VEVENT",
      `UID:${sid}-${r.medId}@next-refill`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(`Refill: ${r.brand}`)}`,
      `DESCRIPTION:${esc(`${what}. Nearest store: ${s.stores?.[0]?.name ?? "see the list"}.`)}`,
      "RRULE:FREQ=MONTHLY;COUNT=12",
      "BEGIN:VALARM",
      "TRIGGER:PT10H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`Refill ${r.brand} at Jan Aushadhi`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${PRODUCT.name}//EN`, "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="refill-reminders.ics"` } });
}
