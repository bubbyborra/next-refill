"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { LANGS } from "@/lib/languages";
import { PRODUCT } from "@/lib/brand";
import { useCall, type PublicState } from "./useCall";
import { StripCamera } from "./StripCamera";
import { SAMPLE_LINES, SAMPLE_STATE } from "@/lib/sample";
import { Mark, WindowBar, packOf } from "./Parts";

const rupees = (n: number | undefined | null) => (n === undefined || n === null ? "–" : `₹${Math.round(n).toLocaleString("en-IN")}`);

type View = null | "call" | "ended" | "loading" | "error";

// The start screen and the call screen. `children` are the sections below the first screen and
// `footer` the site footer; both are static and rendered on the server by the page.
export function CallScreen({ children, footer }: { children?: ReactNode; footer?: ReactNode }) {
  const [lang, setLang] = useState("te");
  const real = useCall();
  // "?state=call" (or "result") and "?state=ended" show a labelled sample call (a real test
  // call's data): a demo without a microphone, and every screen reachable for checks.
  // "?state=loading" and "?state=error" show the start screen while connecting or after a failure.
  const [view, setView] = useState<View>(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("state");
    if (v === "call" || v === "result") setView("call");
    else if (v === "ended" || v === "loading" || v === "error") setView(v);
  }, []);
  const sample = view === "call" || view === "ended";
  const call = sample
    ? { ...real, phase: (view === "call" ? "live" : "ended") as typeof real.phase, mood: "listening" as const, lines: SAMPLE_LINES, state: SAMPLE_STATE, sid: "sample" }
    : view === "loading"
      ? { ...real, phase: "starting" as typeof real.phase }
      : view === "error" && !real.error
        ? { ...real, phase: "error" as typeof real.phase, error: "Couldn't start the call" }
        : real;
  const live = call.phase === "live" && !sample;
  const showPanel = call.phase !== "idle" && call.phase !== "starting" && call.phase !== "error";

  return (
    <div className="nr-app" id="top">
      <header className="nr-top">
        <div className="nr-top__inner">
          <a href="/" className="nr-brand">
            <Mark />
            <span className="nr-brand__name">{PRODUCT.name}</span>
            <span className="nr-brand__tag">{PRODUCT.tagline}</span>
          </a>
          {/* On the start screen the strip below links every section; the call screen hides the strip, so it gets this link */}
          {showPanel && (
            <a href="#jan-aushadhi" className="nr-top__link">
              What is Jan Aushadhi?
            </a>
          )}
        </div>
      </header>
      {!showPanel && <SubNav />}

      <main className="nr-main">
        {!showPanel && (
          <section className="nr-hero">
            <div className="nr-hero__copy">
              <h1 className="nr-h1">
                <span className="nr-h1__line">Say your medicines.</span> <span className="nr-h1__line">Hear what you&apos;d save.</span>
              </h1>
              <p className="nr-lead">
                Tell it which tablets you buy every month, in your own language. It finds the same medicine at a government Jan
                Aushadhi store, tells you how much less it costs there, and sends the list to your phone.
              </p>
              <div className="nr-start">
                <div className="nr-langs">
                  <p className="nr-langs__label">Talk in</p>
                  <div className="nr-chips">
                    {LANGS.map((l) => (
                      <button key={l.code} onClick={() => setLang(l.code)} className="nr-chip" aria-pressed={lang === l.code} lang={l.code}>
                        {l.native}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nr-actions">
                  <button onClick={() => call.start(lang)} disabled={call.phase === "starting"} className="nr-btn nr-btn--go">
                    <MicIcon />
                    {call.phase === "starting" ? "Connecting…" : "Start talking"}
                  </button>
                  <a href="?state=call" className="nr-samplelink">
                    No microphone? See a sample call
                  </a>
                  <p className="nr-fine">A voice call in your browser. No sign-up, no phone number: you get the list by scanning a QR code.</p>
                </div>
              </div>
              {call.error && (
                <p className="nr-alert" role="alert">
                  {call.error}
                </p>
              )}
            </div>
            <div className="nr-hero__stage">
              <SampleBill />
            </div>
          </section>
        )}

        {showPanel && (
          <>
            {sample && (
              <p className="nr-banner" role="status">
                <span className="nr-banner__tag">Sample call</span>: an illustration built from a real test call on 21 Nov 2026 (typed in Telugu). Prices are as the caller said them; Jan Aushadhi prices are from the official list.{" "}
                <a href="/" className="nr-banner__link">
                  Start your own call
                </a>
              </p>
            )}
            <section className="nr-call">
              <div className="nr-panel nr-convo">
                <WindowBar />
                <div className="nr-convo__head">
                  <MoodPill mood={live ? call.mood : "idle"} ended={call.phase === "ended"} />
                  <div className="nr-convo__ctrls">
                    {live && (
                      <>
                        <button onClick={call.toggleMute} className="nr-btn nr-btn--small nr-btn--ghost">
                          {call.muted ? "Unmute" : "Mute"}
                        </button>
                        <button onClick={call.stop} className="nr-btn nr-btn--small nr-btn--stop">
                          End call
                        </button>
                      </>
                    )}
                    {call.phase === "ended" && !sample && (
                      <button onClick={() => call.start(lang)} className="nr-btn nr-btn--small">
                        New call
                      </button>
                    )}
                  </div>
                </div>
                <Transcript lines={call.lines} lang={call.state?.lang} />
                {live && <TypeBox onSend={call.typeLine} prominent={call.noMic} />}
                {live && call.sid && <StripCamera sid={call.sid} onDone={() => call.refresh(call.sid!)} />}
                <Activity state={call.state} />
              </div>
              <div className="nr-side">
                <Bill state={call.state} />
                <StoreCard state={call.state} />
                {call.sid && <PhoneCard sid={call.sid} state={call.state} />}
              </div>
            </section>
          </>
        )}

        <div className="nr-bar" aria-hidden />
        {children}
      </main>
      {footer}
    </div>
  );
}

// Links to the sections below the first screen, on Era's white strip under the banner.
const NAV = [
  ["#jan-aushadhi", "What is Jan Aushadhi?"],
  ["#why", "Why people miss it"],
  ["#how-it-works", "How it works"],
  ["#how", "How it matches"],
  ["#questions", "Questions"],
] as const;

function SubNav() {
  return (
    <nav className="nr-subnav" aria-label="On this page">
      <div className="nr-subnav__inner">
        {NAV.map(([href, text]) => (
          <a key={href} href={href} className="nr-subnav__link">
            {text}
          </a>
        ))}
      </div>
    </nav>
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
  const state = ended ? "ended" : mood === "speaking" ? "speaking" : mood === "thinking" ? "thinking" : "on";
  return (
    <span className="nr-mood" data-state={state}>
      <span className="nr-mood__dot" />
      {label}
    </span>
  );
}

function Transcript({ lines, lang }: { lines: ReturnType<typeof useCall>["lines"]; lang?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // newer browsers return a promise from scrollIntoView; an effect must return nothing
    void end.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);
  return (
    <div className="nr-transcript" aria-live="polite">
      {lines.length === 0 && <p className="nr-transcript__empty">Say hello. The agent speaks first, then listens.</p>}
      {lines.map((l) => (
        <div key={l.key} className="nr-line" data-who={l.who}>
          <p className="nr-bubble" data-final={l.final ? "yes" : "no"} lang={lang}>
            {l.text}
          </p>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function TypeBox({ onSend, prominent }: { onSend: (t: string) => Promise<void>; prominent: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="nr-type"
      data-prominent={prominent ? "yes" : "no"}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        const t = text;
        setText("");
        await onSend(t);
        setBusy(false);
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={prominent ? "No microphone? Type here, e.g. Telma 40, one a day, 230 for 30" : "Too noisy? Type instead"}
        className="nr-input"
      />
      <button disabled={busy || !text.trim()} className="nr-btn nr-btn--small">
        {busy ? "…" : "Send"}
      </button>
    </form>
  );
}

function Activity({ state }: { state: PublicState | null }) {
  if (!state?.activity.length) return null;
  return (
    <div className="nr-activity">
      <p className="nr-label">What it just did</p>
      <ol className="nr-activity__list">
        {state.activity.slice(-6).map((a) => (
          <li key={a.t + a.text}>{a.text}</li>
        ))}
      </ol>
    </div>
  );
}

function Bill({ state }: { state: PublicState | null }) {
  const meds = state?.meds ?? [];
  const t = state?.totals;
  return (
    <div className="nr-panel nr-bill">
      <WindowBar />
      <div className="nr-bill__head">
        <h2 className="nr-h2">Your medicines</h2>
        <span className="nr-small">per month</span>
      </div>
      {meds.length === 0 && <p className="nr-bill__empty">Medicines you mention appear here, checked against the government list.</p>}
      <ul className="nr-meds">
        {meds.map((m) => (
          <li key={m.id} className="nr-med">
            <div className="nr-med__info">
              <p className="nr-med__brand">
                {m.brand}
                <span className="nr-med__dose">{m.dosesPerDay} a day</span>
              </p>
              <p className="nr-med__comp">{m.composition}</p>
              {m.ja ? (
                <p className="nr-med__ja">
                  Ask for {m.ja.name} · <span className="nr-code">drug code {m.ja.code}</span>
                  {m.ja.mrp !== null && (
                    <>
                      {" · "}
                      <span className="nr-code">
                        ₹{m.ja.mrp} for {packOf(m.ja)}
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <p className="nr-med__miss">Not on the Jan Aushadhi list. Keep your current medicine.</p>
              )}
            </div>
            {m.ja && (
              <dl className="nr-med__prices">
                {m.monthlyBrand !== undefined && (
                  <div className="nr-med__price">
                    <dt>your price</dt>
                    <dd className="nr-med__was" data-struck={m.monthlySaving !== undefined ? "yes" : "no"}>
                      {rupees(m.monthlyBrand)}
                    </dd>
                  </div>
                )}
                <div className="nr-med__price">
                  <dt>Jan Aushadhi</dt>
                  <dd className="nr-med__now">{m.monthlyJa !== undefined ? rupees(m.monthlyJa) : "price?"}</dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ul>
      {t && t.pricedCount > 0 && (
        <div className="nr-total" data-reveal-total>
          <p className="nr-total__label">You save every month</p>
          <p className="nr-total__num">
            <CountUp value={t.monthlySaving} />
          </p>
          <p className="nr-total__sub">
            {rupees(t.yearlySaving)} a year · {rupees(t.monthlyBrand)} now → {rupees(t.monthlyJa)} at Jan Aushadhi
          </p>
        </div>
      )}
    </div>
  );
}

type DesignRuntime = { reduce?: boolean; record?: boolean; onReplay?: (fn: () => void) => void };

// The saving total counts up to its new value when the result lands. Reduced motion shows the
// number at once; record mode (?record=1) slows it down; R replays it during a demo.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() =>
    typeof window !== "undefined" && !(window as unknown as { design?: DesignRuntime }).design?.reduce ? 0 : value,
  );
  const from = useRef(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const d = (window as unknown as { design?: DesignRuntime }).design;
    d?.onReplay?.(() => {
      from.current = 0;
      setRun((n) => n + 1);
    });
  }, []);
  useEffect(() => {
    const d = (window as unknown as { design?: DesignRuntime }).design;
    const start = from.current;
    from.current = value;
    // Background tabs pause animation frames, so the number is set outright there, and a timer
    // makes sure the final value always lands even if frames stop mid-count.
    if (d?.reduce || start === value || document.hidden) {
      setShown(value);
      return;
    }
    const ms = 900 * (d?.record ? 1.5 : 1);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const land = setTimeout(() => {
      cancelAnimationFrame(raf);
      setShown(value);
    }, ms + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(land);
    };
  }, [value, run]);
  return <>{rupees(shown)}</>;
}

function StoreCard({ state }: { state: PublicState | null }) {
  const s = state?.stores?.[0];
  if (!s) return null;
  return (
    <div className="nr-panel nr-store">
      <p className="nr-label">Nearest Jan Aushadhi store</p>
      <p className="nr-store__name">{s.name}</p>
      <p className="nr-store__addr">{s.address}</p>
      <div className="nr-store__row">
        <span className="nr-tag">about {s.km} km</span>
        <a href={s.mapsUrl} target="_blank" rel="noreferrer" className="nr-link">
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
    if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#101010", light: "#ffffff" } }).then(setQr);
  }, [url]);
  const sent = Boolean(state?.sent);
  return (
    <div className="nr-panel nr-phonecard" data-sent={sent ? "yes" : "no"}>
      {qr && <img src={qr} alt="QR code for this list on your phone" className="nr-phonecard__qr" />}
      <div>
        <p className="nr-phonecard__title">{sent ? "Sent to your phone" : "On your phone"}</p>
        <p className="nr-phonecard__text">
          {sent
            ? `Scan to open the list for the pharmacist, directions, and refill reminders from ${state?.sent?.reminders[0]?.date ?? ""}.`
            : "Scan to follow along. Say yes when it offers to send the list, and the reminders appear here."}
        </p>
        <a href={`/p/${sid}`} target="_blank" rel="noreferrer" className="nr-link">
          Open the list
        </a>
      </div>
    </div>
  );
}

const SAMPLE_ROWS = [
  { brand: "Telma 40", comp: "Telmisartan 40 mg", dose: "1 a day" },
  { brand: "Glycomet 500", comp: "Metformin 500 mg", dose: "2 a day" },
];

function SampleBill() {
  return (
    <figure className="nr-sample" aria-labelledby="sample-cap">
      <WindowBar />
      <div className="nr-sample__head">
        <span className="nr-sample__app">
          <Mark />
          {PRODUCT.name}
        </span>
        <p className="nr-sample__cap" id="sample-cap">
          From a sample call
        </p>
      </div>
      <div className="nr-sample__card">
        <div className="nr-sample__rows">
          {SAMPLE_ROWS.map((r) => (
            <div key={r.brand} className="nr-sample__row">
              <p className="nr-sample__brand">
                {r.brand} <span className="nr-sample__dose">{r.dose}</span>
              </p>
              <p className="nr-sample__comp">{r.comp} · same salt, same strength</p>
            </div>
          ))}
        </div>
        <div className="nr-sample__total">
          <p className="nr-sample__small">Saved every month in the sample call</p>
          <p className="nr-sample__big">₹{SAMPLE_STATE.totals.monthlySaving}</p>
          <p className="nr-sample__small">
            ₹{SAMPLE_STATE.totals.monthlyBrand} at the chemist (the caller&apos;s prices), ₹{SAMPLE_STATE.totals.monthlyJa} at Jan Aushadhi
          </p>
        </div>
      </div>
    </figure>
  );
}
