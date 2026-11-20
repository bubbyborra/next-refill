"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { LANGS } from "@/lib/languages";
import { PRODUCT } from "@/lib/brand";
import { useCall, type PublicState } from "./useCall";
import { StripCamera } from "./StripCamera";

const rupees = (n: number | undefined | null) => (n === undefined || n === null ? "–" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export function CallScreen() {
  const [lang, setLang] = useState("te");
  const call = useCall();
  const live = call.phase === "live";
  const showPanel = call.phase !== "idle" && call.phase !== "starting" && call.phase !== "error";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="text-lg font-bold tracking-tight text-ink">{PRODUCT.name}</p>
            <p className="text-sm text-ink-soft">{PRODUCT.tagline}</p>
          </div>
        </div>
        <a href="#how" className="hidden text-sm text-ink-soft underline-offset-4 hover:underline sm:block">
          How it checks
        </a>
      </header>

      {!showPanel && (
        <section className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              Say your medicines.
              <br />
              <span className="text-leaf">Hear what you'd save.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Tell it, in your own language, which tablets you buy every month. It finds the same salt and strength in the
              government&apos;s Jan Aushadhi list, works out the monthly saving, finds the nearest Jan Aushadhi store and puts
              it all on your phone.
            </p>
            <div className="mt-7">
              <p className="mb-2 text-sm font-medium text-ink-soft">Talk in</p>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`rounded-full border px-4 py-2 text-base transition ${
                      lang === l.code ? "border-leaf bg-leaf text-white" : "border-line bg-paper text-ink hover:border-leaf"
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                onClick={() => call.start(lang)}
                disabled={call.phase === "starting"}
                className="flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-lg font-semibold text-white shadow-lg shadow-ink/20 transition hover:bg-leaf disabled:opacity-60"
              >
                <MicIcon />
                {call.phase === "starting" ? "Connecting…" : "Start talking"}
              </button>
              <p className="text-sm text-ink-soft">Uses your microphone. No sign-up.</p>
            </div>
            {call.error && (
              <p className="mt-4 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">
                {call.error}
              </p>
            )}
          </div>
          <SampleBill />
        </section>
      )}

      {showPanel && (
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col rounded-3xl border border-line bg-paper p-5">
            <div className="flex items-center justify-between">
              <MoodPill mood={live ? call.mood : "idle"} ended={call.phase === "ended"} />
              <div className="flex gap-2">
                {live && (
                  <>
                    <button onClick={call.toggleMute} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                      {call.muted ? "Unmute" : "Mute"}
                    </button>
                    <button onClick={call.stop} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">
                      End call
                    </button>
                  </>
                )}
                {call.phase === "ended" && (
                  <button onClick={() => call.start(lang)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                    New call
                  </button>
                )}
              </div>
            </div>
            <Transcript lines={call.lines} />
            {live && call.sid && <StripCamera sid={call.sid} onDone={() => call.refresh(call.sid!)} />}
            <Activity state={call.state} />
          </div>
          <div className="flex flex-col gap-6">
            <Bill state={call.state} />
            <StoreCard state={call.state} />
            {call.sid && <PhoneCard sid={call.sid} state={call.state} />}
          </div>
        </section>
      )}

      <HowItChecks />
    </main>
  );
}

function Mark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect x="2" y="9" width="36" height="22" rx="11" fill="#0f6b4f" />
      <rect x="20" y="9" width="18" height="22" rx="0" fill="#f6efe1" />
      <rect x="20" y="9" width="18" height="22" rx="11" fill="#f6efe1" />
      <rect x="2" y="9" width="36" height="22" rx="11" fill="none" stroke="#14261d" strokeWidth="2" />
      <path d="M20 9v22" stroke="#14261d" strokeWidth="2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoodPill({ mood, ended }: { mood: string; ended: boolean }) {
  const label = ended ? "Call ended" : mood === "speaking" ? "Speaking" : mood === "thinking" ? "Checking" : mood === "listening" ? "Listening" : "Connected";
  return (
    <span className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-sm font-medium text-ink">
      <span className={`h-2.5 w-2.5 rounded-full ${ended ? "bg-ink-soft" : mood === "speaking" ? "animate-pulse bg-leaf" : mood === "thinking" ? "animate-pulse bg-amber" : "bg-leaf"}`} />
      {label}
    </span>
  );
}

function Transcript({ lines }: { lines: ReturnType<typeof useCall>["lines"] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [lines]);
  return (
    <div className="mt-4 h-80 overflow-y-auto pr-1" aria-live="polite">
      {lines.length === 0 && <p className="text-ink-soft">Say hello. The agent speaks first, then listens.</p>}
      {lines.map((l) => (
        <div key={l.key} className={`mb-3 flex ${l.who === "you" ? "justify-end" : "justify-start"}`}>
          <p
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[17px] leading-snug ${
              l.who === "you" ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm bg-cream text-ink"
            } ${l.final ? "" : "opacity-70"}`}
          >
            {l.text}
          </p>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function Activity({ state }: { state: PublicState | null }) {
  if (!state?.activity.length) return null;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">What it just did</p>
      <ol className="space-y-1.5 text-sm text-ink">
        {state.activity.slice(-6).map((a) => (
          <li key={a.t + a.text} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
            {a.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Bill({ state }: { state: PublicState | null }) {
  const meds = state?.meds ?? [];
  const t = state?.totals;
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">Your medicines</h2>
        <span className="text-xs text-ink-soft">per month</span>
      </div>
      {meds.length === 0 && <p className="mt-4 text-ink-soft">Medicines you mention appear here, checked against the government list.</p>}
      <ul className="mt-3 divide-y divide-line">
        {meds.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">
                  {m.brand}
                  <span className="ml-2 text-sm font-normal text-ink-soft">{m.dosesPerDay} a day</span>
                </p>
                <p className="text-sm text-ink-soft">{m.composition}</p>
                {m.ja ? (
                  <p className="mt-1 text-sm text-leaf">
                    Jan Aushadhi: {m.ja.name} · code {m.ja.code}
                    {m.ja.mrp !== null && ` · ₹${m.ja.mrp} per ${m.ja.unit}`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-coral">Not on the Jan Aushadhi list. Keep your current medicine.</p>
                )}
              </div>
              <div className="text-right">
                {m.monthlySaving !== undefined ? (
                  <>
                    <p className="text-sm text-ink-soft line-through">{rupees(m.monthlyBrand)}</p>
                    <p className="text-lg font-bold text-ink">{rupees(m.monthlyJa)}</p>
                  </>
                ) : m.ja ? (
                  <p className="text-sm text-ink-soft">{m.monthlyJa !== undefined ? rupees(m.monthlyJa) : "price?"}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {t && t.pricedCount > 0 && (
        <div className="mt-2 rounded-2xl bg-leaf px-5 py-4 text-white">
          <p className="text-sm opacity-90">You save every month</p>
          <p className="text-4xl font-bold tracking-tight">{rupees(t.monthlySaving)}</p>
          <p className="text-sm opacity-90">
            {rupees(t.yearlySaving)} a year · {rupees(t.monthlyBrand)} now → {rupees(t.monthlyJa)} at Jan Aushadhi
          </p>
        </div>
      )}
    </div>
  );
}

function StoreCard({ state }: { state: PublicState | null }) {
  const s = state?.stores?.[0];
  if (!s) return null;
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Nearest Jan Aushadhi store</p>
      <p className="mt-1 font-semibold text-ink">{s.name}</p>
      <p className="text-sm text-ink-soft">{s.address}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-full bg-cream px-3 py-1 text-sm text-ink">about {s.km} km</span>
        <a href={s.mapsUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-leaf underline-offset-4 hover:underline">
          Directions
        </a>
      </div>
    </div>
  );
}

function PhoneCard({ sid, state }: { sid: string; state: PublicState | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/p/${sid}`), [sid]);
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#14261d", light: "#ffffff" } }).then(setQr);
  }, [url]);
  const sent = Boolean(state?.sent);
  return (
    <div className={`flex items-center gap-5 rounded-3xl border p-5 ${sent ? "border-leaf bg-leaf/5" : "border-line bg-white"}`}>
      {qr && <img src={qr} alt="QR code for this list on your phone" className="h-28 w-28 rounded-lg" />}
      <div>
        <p className="font-semibold text-ink">{sent ? "Sent to your phone" : "On your phone"}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {sent
            ? `Scan to open the list for the pharmacist, directions, and refill reminders from ${state?.sent?.reminders[0]?.date ?? ""}.`
            : "Scan to follow along. Say yes when it offers to send the list, and the reminders appear here."}
        </p>
        <a href={`/p/${sid}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-leaf">
          Open the list
        </a>
      </div>
    </div>
  );
}

function SampleBill() {
  return (
    <figure className="rotate-1 rounded-3xl border border-line bg-white p-6 shadow-xl shadow-ink/10">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">Illustration of a finished list</figcaption>
      {[
        ["Telma 40", "Telmisartan 40 mg", "1 a day"],
        ["Glycomet 500", "Metformin 500 mg", "2 a day"],
      ].map(([b, c, d]) => (
        <div key={b} className="border-b border-line py-3">
          <p className="font-semibold text-ink">
            {b} <span className="text-sm font-normal text-ink-soft">{d}</span>
          </p>
          <p className="text-sm text-ink-soft">{c} · same salt, same strength</p>
        </div>
      ))}
      <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
        <p className="text-sm text-ink-soft">The call works out</p>
        <p className="text-2xl font-bold text-ink">your monthly saving</p>
        <p className="text-sm text-ink-soft">from your strip&apos;s price and the government&apos;s list</p>
      </div>
    </figure>
  );
}

function HowItChecks() {
  return (
    <section id="how" className="mt-16 grid gap-6 border-t border-line pt-10 sm:grid-cols-3">
      <div>
        <p className="font-semibold text-ink">Same medicine only</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          A match needs the same ingredients, strength, form and release type (SR, gastro-resistant…) as your strip. It never
          suggests a different medicine, strength or dose.
        </p>
      </div>
      <div>
        <p className="font-semibold text-ink">Government data</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Prices come from PMBI&apos;s Jan Aushadhi product list, and stores from its Locate Kendra list (528 stores in
          Bengaluru Urban).
        </p>
      </div>
      <div>
        <p className="font-semibold text-ink">Not medical advice</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Show the list to your pharmacist, and ask your doctor if you have any doubt. It doesn&apos;t sell medicines or keep
          your phone number.
        </p>
      </div>
    </section>
  );
}
