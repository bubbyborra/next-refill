"use client";
// The caller's list on their phone: what to ask the pharmacist for, the saving,
// the nearest store, refill reminders and a WhatsApp share. Updates live during the call.
import { useEffect, useState } from "react";
import { PRODUCT } from "@/lib/brand";
import type { PublicState } from "./useCall";

const rupees = (n?: number | null) => (n === undefined || n === null ? "–" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export function PhoneList({ sid }: { sid: string }) {
  const [s, setS] = useState<PublicState | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetch(`/api/state?sid=${sid}`, { cache: "no-store" });
      if (!alive) return;
      if (r.status === 404) setMissing(true);
      else if (r.ok) setS((await r.json()) as PublicState);
    };
    void load();
    const t = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sid]);

  if (missing) return <p className="p-6 text-ink">This list has expired or doesn&apos;t exist.</p>;
  if (!s) return <p className="p-6 text-ink-soft">Loading the list…</p>;
  const matched = s.meds.filter((m) => m.ja);
  const store = s.stores?.[0];
  const share = [
    `${PRODUCT.name}: Jan Aushadhi list`,
    ...matched.map((m) => `• ${m.brand} → ${m.ja!.name} (code ${m.ja!.code})${m.ja!.mrp !== null ? ` ₹${m.ja!.mrp}/${m.ja!.unit}` : ""}`),
    s.totals.pricedCount ? `Saving: ${rupees(s.totals.monthlySaving)} a month` : "",
    store ? `Store: ${store.name}, ${store.address} ${store.mapsUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-5">
      <p className="text-sm font-semibold text-accent">{PRODUCT.name}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">Show this to the pharmacist</h1>
      <p className="mt-1 text-sm text-ink-soft">Same salt, same strength, from the Jan Aushadhi list. Ask your doctor if in doubt.</p>

      {s.totals.pricedCount > 0 && (
        <div className="mt-5 rounded-2xl bg-accent px-5 py-4 text-white">
          <p className="text-sm opacity-90">You save every month</p>
          <p className="text-4xl font-bold">{rupees(s.totals.monthlySaving)}</p>
          <p className="text-sm opacity-90">{rupees(s.totals.yearlySaving)} a year</p>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {s.meds.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-ink-soft">Instead of {m.brand}</p>
            {m.ja ? (
              <>
                <p className="mt-1 text-lg font-bold leading-snug text-ink">{m.ja.name}</p>
                <p className="mt-1 text-sm text-ink">
                  Drug code <span className="font-mono font-semibold">{m.ja.code}</span>
                  {m.ja.mrp !== null && ` · ₹${m.ja.mrp} per ${m.ja.unit}`}
                </p>
                {m.monthlySaving !== undefined && (
                  <p className="mt-1 text-sm text-accent">
                    {rupees(m.monthlyBrand)} → {rupees(m.monthlyJa)} a month
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-ink">Not on the Jan Aushadhi list: keep buying {m.brand}.</p>
            )}
          </li>
        ))}
      </ul>

      {store && (
        <div className="mt-5 rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Nearest store · about {store.km} km</p>
          <p className="mt-1 font-semibold text-ink">{store.name}</p>
          <p className="text-sm text-ink-soft">{store.address}</p>
          <a href={store.mapsUrl} className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            Directions
          </a>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {s.sent && (
          <a href={`/api/ics/${sid}`} className="rounded-full border border-ink px-4 py-3 text-center font-semibold text-ink">
            Add monthly refill reminders (from {s.sent.reminders[0]?.date})
          </a>
        )}
        {matched.length > 0 && (
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} className="rounded-full bg-ink px-4 py-3 text-center font-semibold text-white">
            Share on WhatsApp
          </a>
        )}
      </div>
      <p className="mt-8 text-xs text-ink-soft">
        Prices: PMBI Jan Aushadhi product list. Stores: janaushadhi.gov.in Locate Kendra. Distances are approximate.
      </p>
    </main>
  );
}
