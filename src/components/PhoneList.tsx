"use client";
// The caller's list on their phone: what to ask the pharmacist for, the saving,
// the nearest store, refill reminders and a WhatsApp share. Updates live during the call.
import { useEffect, useState } from "react";
import { PRODUCT } from "@/lib/brand";
import { getLang } from "@/lib/languages";
import type { PublicState } from "./useCall";
import { SAMPLE_STATE } from "@/lib/sample";

const rupees = (n?: number | null) => (n === undefined || n === null ? "–" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export function PhoneList({ sid }: { sid: string }) {
  const [s, setS] = useState<PublicState | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (sid === "sample") {
      setS(SAMPLE_STATE);
      return;
    }
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

  if (missing) return <p className="nr-list nr-list__sub">This list has expired or doesn&apos;t exist.</p>;
  if (!s) return <p className="nr-list nr-list__sub">Loading the list…</p>;
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
    <main className="nr-list">
      <p className="nr-list__brand">
        <ListMark />
        {PRODUCT.name}
      </p>
      {sid === "sample" && <p className="nr-list__note">Sample list from a real test call (21 Nov 2026), shown as an illustration.</p>}
      <h1 className="nr-list__h1">Show this to the pharmacist</h1>
      <p className="nr-list__sub">Same salt, same strength, from the Jan Aushadhi list. Ask your doctor if in doubt.</p>

      {s.totals.pricedCount > 0 && (
        <div className="nr-total">
          <p className="nr-total__label">You save every month</p>
          <p className="nr-total__num">{rupees(s.totals.monthlySaving)}</p>
          <p className="nr-total__sub">{rupees(s.totals.yearlySaving)} a year</p>
        </div>
      )}

      <ul className="nr-list__meds">
        {s.meds.map((m) => (
          <li key={m.id} className="nr-panel nr-list__med">
            <p className="nr-list__instead">Instead of {m.brand}</p>
            {m.ja ? (
              <>
                <p className="nr-list__name">{m.ja.name}</p>
                <p className="nr-list__code">
                  Drug code <strong>{m.ja.code}</strong>
                  {m.ja.mrp !== null && ` · ₹${m.ja.mrp} per ${m.ja.unit}`}
                </p>
                {m.monthlySaving !== undefined && (
                  <p className="nr-list__save">
                    {rupees(m.monthlyBrand)} → {rupees(m.monthlyJa)} a month
                  </p>
                )}
              </>
            ) : (
              <p className="nr-list__name">Not on the Jan Aushadhi list: keep buying {m.brand}.</p>
            )}
          </li>
        ))}
      </ul>

      {store && (
        <div className="nr-panel nr-list__store">
          <p className="nr-label">Nearest store · about {store.km} km</p>
          <p className="nr-store__name">{store.name}</p>
          <p className="nr-store__addr">{store.address}</p>
          <a href={store.mapsUrl} className="nr-btn nr-btn--small nr-list__dir">
            Directions
          </a>
        </div>
      )}

      <div className="nr-list__actions">
        {s.meds.length > 0 && sid !== "sample" && <ListenButton sid={sid} label={`Listen in ${getLang(s.lang).native}`} />}
        {s.sent && (
          <a href={`/api/ics/${sid}`} className="nr-btn nr-btn--ghost">
            Add monthly refill reminders (from {s.sent.reminders[0]?.date})
          </a>
        )}
        {matched.length > 0 && (
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} className="nr-btn">
            Share on WhatsApp
          </a>
        )}
      </div>
      <p className="nr-list__foot">
        Prices: PMBI Jan Aushadhi product list. Stores: janaushadhi.gov.in Locate Kendra. Distances are approximate.
      </p>
    </main>
  );
}

function ListMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden className="nr-mark">
      <rect x="2" y="9" width="36" height="22" rx="11" className="nr-mark__a" />
      <rect x="20" y="9" width="18" height="22" rx="0" className="nr-mark__b" />
      <rect x="20" y="9" width="18" height="22" rx="11" className="nr-mark__b" />
      <rect x="2" y="9" width="36" height="22" rx="11" fill="none" strokeWidth="2" className="nr-mark__line" />
      <path d="M20 9v22" strokeWidth="2" className="nr-mark__line" />
    </svg>
  );
}

function ListenButton({ sid, label }: { sid: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  return src ? (
    <audio src={src} controls autoPlay className="nr-list__audio" />
  ) : (
    <button onClick={() => setSrc(`/api/voice/${sid}?t=${Date.now()}`)} className="nr-btn nr-btn--listen">
      {label}
    </button>
  );
}
