// Walks the demo path on the live site with a real spoken call. A synthetic caller (macOS
// voices; the lines are in scripts/demo-audio/lines.json) is fed into the browser as the
// microphone, and the real agent answers through Agora Conversational AI (Sarvam
// speech-to-text, our model endpoint, a Murf Falcon voice).
//
// It checks that the call ends with both medicines matched on the official list, the right
// monthly saving, a store found and the list sent; that every agent line is in the caller's
// language and never mentions its tools; that the reminders file and the voice note download.
// It prints how long each answer took to start: from the end of the caller's line to the
// agent's "Speaking" state on the page (speech-to-text endpointing included).
//
// Usage: node scripts/demo_path.mjs [base-url] [lang] [--typed]
//   defaults: https://next-refill.vercel.app te   (lang: te or hi)
//   --typed sends each caller line through "Type instead" (the noisy-room path) instead of
//   speaking it; the agent must still say every reply on the call.
// Each run is a real call of about two minutes on the project's Agora, Sarvam, Murf and
// Anthropic accounts. Screenshots, a screen recording and result.json go to out/demo-path/.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const TYPED = process.argv.includes("--typed");
const BASE = (ARGS[0] || "https://next-refill.vercel.app").replace(/\/$/, "");
const LANG = ARGS[1] || "te";
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const AUDIO = path.join(ROOT, "scripts", "demo-audio");
const SCRIPT = JSON.parse(fs.readFileSync(path.join(AUDIO, "lines.json"), "utf8"))[LANG];
const OUT = path.join(ROOT, "out", "demo-path", `${LANG}${TYPED ? "-typed" : ""}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
const SCRIPT_CHARS = { te: /[ఀ-౿]/, hi: /[ऀ-ॿ]/ }[LANG];
if (!SCRIPT || !SCRIPT_CHARS) {
  console.error(`demo_path: no caller lines for "${LANG}" (te or hi)`);
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

// What each caller line must lead to before the next one is said.
const TURNS = [
  { what: "Telma 40 matched to Jan Aushadhi code 300", until: (s) => s.meds?.some((m) => m.ja?.code === "300") },
  { what: "Glycomet 500 matched to code 145", until: (s) => s.meds?.some((m) => m.ja?.code === "145") },
  { what: "nearest store found", until: (s) => (s.stores?.length ?? 0) > 0 },
  { what: "list sent to the phone", until: (s) => Boolean(s.sent) },
];

// Runs in the page before the app: the microphone becomes a WebAudio stream the test can
// speak into, and the agent's state pill is sampled every 100 ms with a timestamp.
function pageHooks() {
  let ctx = null;
  let dest = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: 48000 });
      dest = ctx.createMediaStreamDestination();
    }
    return { ctx, dest };
  };
  const md = navigator.mediaDevices;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (c && c.audio) {
      const { ctx: a, dest: d } = ensure();
      await a.resume();
      return new MediaStream([d.stream.getAudioTracks()[0].clone()]);
    }
    return original(c);
  };
  window.__say = async (b64) => {
    const { ctx: a, dest: d } = ensure();
    await a.resume();
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const buf = await a.decodeAudioData(bytes.buffer);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(d);
    await new Promise((r) => {
      src.onended = r;
      src.start();
    });
    return buf.duration;
  };
  // Every agent message the app parses (transcripts, state, errors), for the report.
  window.__rtm = [];
  const parse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const v = parse.call(this, text, reviver);
    try {
      if (v && typeof v === "object" && typeof v.object === "string" && window.__rtm.length < 400) window.__rtm.push({ t: Date.now(), ...v });
    } catch {}
    return v;
  };
  window.__moods = [];
  setInterval(() => {
    const el = document.querySelector(".nr-mood");
    const label = el ? el.textContent.trim() : "";
    const last = window.__moods[window.__moods.length - 1];
    if (!last || last.label !== label) window.__moods.push({ t: Date.now(), label });
  }, 100);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const turns = [];
const result = { base: BASE, lang: LANG, startedAt: new Date().toISOString(), turns, failures };

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 860 } },
  permissions: ["microphone"],
});
await context.addInitScript(pageHooks);
const page = await context.newPage();
const pageErrors = [];
const consoleLines = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)));

// The call state from the server. A failed poll (a network blip) counts as "nothing yet";
// the final read retries before giving up.
async function state(sid, tries = 1) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/state?sid=${sid}`, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}
    if (i < tries - 1) await sleep(1000);
  }
  return {};
}
const moods = () => page.evaluate(() => window.__moods);
const quiet = (label) => label === "Listening" || label === "Connected";

// The agent's lines on the page, with whether each is final.
const agentLines = () =>
  page.$$eval('.nr-line[data-who="agent"] .nr-bubble', (els) => els.map((e) => ({ text: e.innerText.trim(), final: e.getAttribute("data-final") === "yes" })));
const rtmLog = () => page.evaluate(() => window.__rtm);

// Waits until the agent has answered since `since` (a Speaking state, or more agent lines than
// `baseline`), `until(state)` holds, and for 1.5 s nothing has changed while the agent is quiet
// and its last line is final. Returns the state and the logs.
async function waitForAgent(sid, since, until, baseline, timeoutMs = 75000) {
  const deadline = Date.now() + timeoutMs;
  let s = {};
  let sig = "";
  let sigAt = Date.now();
  while (Date.now() < deadline) {
    await sleep(400);
    const log = await moods();
    const lines = await agentLines();
    s = await state(sid);
    const last = log[log.length - 1];
    const tail = lines[lines.length - 1];
    const now = `${last?.label}|${lines.length}|${tail?.text.length}|${tail?.final}`;
    if (now !== sig) {
      sig = now;
      sigAt = Date.now();
    }
    const spoke = log.some((m) => m.t >= since && m.label === "Speaking") || lines.length > baseline;
    const settled = (!last || quiet(last.label)) && (!tail || tail.final) && Date.now() - sigAt >= 1500;
    if (spoke && until(s) && settled) return { ok: true, s, log, lines };
  }
  return { ok: false, s, log: await moods(), lines: await agentLines() };
}

const transcript = () =>
  page.$$eval(".nr-line", (els) => els.map((e) => ({ who: e.getAttribute("data-who"), text: e.innerText.trim() })));

let sid = null;
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click(`button.nr-chip[lang="${LANG}"]`);
  const sessionResp = page.waitForResponse((r) => r.url().includes("/api/session") && r.request().method() === "POST", { timeout: 45000 });
  const t0 = Date.now();
  await page.click("button.nr-btn--go");
  const resp = await sessionResp;
  const sess = await resp.json();
  if (!resp.ok()) throw new Error(`session start failed: ${resp.status()} ${JSON.stringify(sess)}`);
  sid = sess.sid;
  result.sid = sid;

  // The agent greets first.
  const greet = await waitForAgent(sid, t0, () => true, 0, 45000);
  const firstWord = (await rtmLog()).find((m) => m.object === "assistant.transcription");
  result.greetingAfterMs = firstWord ? firstWord.t - t0 : null;
  if (!greet.ok) throw new Error("the agent never greeted (no agent line within 45 s)");
  await page.screenshot({ path: path.join(OUT, "0-greeting.png") });

  for (let i = 0; i < TURNS.length; i++) {
    const b64 = fs.readFileSync(path.join(AUDIO, `${LANG}-${i + 1}.mp3`)).toString("base64");
    const said = SCRIPT.lines[i];
    const baseline = (await agentLines()).length;
    const tStart = Date.now();
    let seconds = 0;
    if (TYPED) {
      await page.fill("form.nr-type input", said);
      await page.click("form.nr-type button");
    } else {
      seconds = await page.evaluate((b) => window.__say(b), b64);
    }
    const tEnd = Date.now();
    const w = await waitForAgent(sid, tEnd, TURNS[i].until, baseline);
    const after = w.log.filter((m) => m.t >= tEnd);
    const msgs = (await rtmLog()).filter((m) => m.t >= tStart);
    const heard = msgs.find((m) => m.object === "user.transcription" && m.final);
    const firstAnswer = msgs.find((m) => m.object === "assistant.transcription" && m.t >= tEnd);
    const checking = after.find((m) => m.label === "Checking");
    const speaking = after.find((m) => m.label === "Speaking");
    const turn = {
      said,
      heardAs: heard?.text ?? null,
      seconds: Math.round(seconds * 10) / 10,
      expect: TURNS[i].what,
      ok: w.ok,
      firstAgentWordsAfterMs: firstAnswer ? firstAnswer.t - tEnd : null,
      checkingAfterMs: checking ? checking.t - tEnd : null,
      speakingAfterMs: speaking ? speaking.t - tEnd : null,
    };
    turns.push(turn);
    await page.screenshot({ path: path.join(OUT, `${i + 1}-turn.png`) });
    console.log(
      `turn ${i + 1}: ${w.ok ? "ok  " : "FAIL"} ${TURNS[i].what}; agent's first words ${turn.firstAgentWordsAfterMs ?? "?"} ms and Speaking state ${turn.speakingAfterMs ?? "?"} ms after the caller stopped (line ${turn.seconds} s)`,
    );
    if (heard) console.log(`        heard as: ${heard.text}`);
    if (!w.ok) {
      failures.push(`turn ${i + 1}: ${TURNS[i].what} did not happen within 75 s`);
      break;
    }
  }

  const s = await state(sid, 5);
  result.state ={ meds: s.meds, totals: s.totals, stores: s.stores?.slice(0, 1), sent: s.sent, activity: s.activity };
  result.transcript = await transcript();
  await page.screenshot({ path: path.join(OUT, "call-done.png"), fullPage: true });

  if (!failures.length) {
    if (Math.round(s.totals?.monthlySaving ?? -1) !== 302)
      failures.push(`monthly saving is ${s.totals?.monthlySaving}, expected 302 (Rs 230 -> 37.14 and Rs 150 -> 40.86)`);
    // The phone page, as a judge's phone would show it.
    const phone = await context.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${BASE}/p/${sid}`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(1500);
    await phone.screenshot({ path: path.join(OUT, "phone.png"), fullPage: true });
    const phoneText = await phone.innerText("body");
    if (!phoneText.includes("300") || !phoneText.includes("145")) failures.push("the phone page doesn't show both drug codes (300, 145)");
    await phone.close();
    const ics = await fetch(`${BASE}/api/ics/${sid}`);
    result.ics = { status: ics.status, type: ics.headers.get("content-type") };
    if (ics.status !== 200 || !String(result.ics.type).includes("calendar")) failures.push(`reminders file: ${ics.status} ${result.ics.type}`);
    const voice = await fetch(`${BASE}/api/voice/${sid}`);
    const bytes = (await voice.arrayBuffer()).byteLength;
    result.voiceNote = { status: voice.status, type: voice.headers.get("content-type"), bytes };
    if (voice.status !== 200 || bytes < 10000) failures.push(`voice note: ${voice.status}, ${bytes} bytes`);
  }

  for (const l of result.transcript.filter((l) => l.who === "agent")) {
    if (!SCRIPT_CHARS.test(l.text)) failures.push(`agent line not in the caller's script: "${l.text.slice(0, 80)}"`);
    if (/\b(tools?|function|check_medicine|find_nearest_store|send_list_to_phone|remove_medicine|json)\b/i.test(l.text))
      failures.push(`agent line mentions its tools: "${l.text.slice(0, 80)}"`);
  }
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(" | ").slice(0, 300)}`);
} catch (e) {
  failures.push(`${e?.message || e}${e?.cause?.code ? ` (${e.cause.code})` : ""} at ${String(e?.stack || "").split("\n")[1]?.trim() || "?"}`);
  try {
    result.transcript = await transcript();
    await page.screenshot({ path: path.join(OUT, "failed.png"), fullPage: true });
  } catch {}
} finally {
  try {
    if (await page.$("button.nr-btn--stop")) await page.click("button.nr-btn--stop");
    await sleep(1500);
  } catch {}
  result.moods = await moods().catch(() => []);
  result.agentMessages = await page.evaluate(() => window.__rtm).catch(() => []);
  result.presence = await page.evaluate(() => window.__nrPresence ?? []).catch(() => []);
  result.console = consoleLines.slice(-80);
  const video = page.video();
  await context.close();
  await browser.close();
  try {
    if (video) fs.renameSync(await video.path(), path.join(OUT, "call.webm"));
  } catch {}
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(result, null, 1));
}

console.log("\nTranscript:");
for (const l of result.transcript || []) console.log(`  ${l.who === "agent" ? "agent" : "you  "}: ${l.text}`);
if (result.state?.totals) console.log(`\nTotals: Rs ${result.state.totals.monthlyBrand} -> Rs ${result.state.totals.monthlyJa} a month, saving Rs ${result.state.totals.monthlySaving}`);
console.log(`Greeting started ${result.greetingAfterMs ?? "?"} ms after Start talking`);
console.log(`Output: ${OUT}`);
console.log(failures.length ? `\ndemo path: ${failures.length} failure(s)\n  - ${failures.join("\n  - ")}` : "\ndemo path: the spoken call completed every step");
process.exit(failures.length ? 1 : 0);
