// Walks the "Show the strip to the camera" path on the live site. The camera is a canvas
// showing a test label (scripts/fixtures/strip-telvas-40.jpg: a fictional brand, "TELVAS 40",
// Telmisartan IP 40 mg, Rs 66 for 10), the test takes the photo in the real call screen, and
// checks that the strip is read, that the agent says what it read on the call, and that after
// a typed "One a day." the medicine is matched to Jan Aushadhi code 300 with the saving worked
// out from the strip's price (Rs 198 a month -> Rs 37).
//
// Usage: node scripts/strip_path.mjs [base-url]   (default https://next-refill.vercel.app)
// Each run is a short real call (English) on the project's Agora, Murf and Anthropic accounts.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.argv[2] || "https://next-refill.vercel.app").replace(/\/$/, "");
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LABEL = fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "strip-telvas-40.jpg")).toString("base64");
const OUT = path.join(ROOT, "out", "strip-path", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const result = { base: BASE, startedAt: new Date().toISOString(), failures };

async function state(sid) {
  try {
    const r = await fetch(`${BASE}/api/state?sid=${sid}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {}
  return {};
}
async function until(what, fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`${what} did not happen within ${Math.round(timeoutMs / 1000)} s`);
}

// The microphone is a silent WebAudio stream; the camera is a canvas showing the test label.
function fakeDevices(label) {
  const md = navigator.mediaDevices;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (c && c.video) {
      window.__fakeCam = { asked: true };
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const g = canvas.getContext("2d");
      const img = new Image();
      img.src = `data:image/jpeg;base64,${label}`;
      try {
        await img.decode();
        window.__fakeCam.decoded = true;
      } catch (err) {
        window.__fakeCam.decodeError = String(err);
      }
      const draw = () => g.drawImage(img, 0, 0, 1280, 720);
      draw();
      setInterval(draw, 200);
      return canvas.captureStream(5);
    }
    if (c && c.audio) {
      const ctx = new AudioContext();
      await ctx.resume();
      return ctx.createMediaStreamDestination().stream;
    }
    return original(c);
  };
}

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone", "camera"] });
await context.addInitScript(fakeDevices, LABEL);
const page = await context.newPage();
const agentLines = () => page.$$eval('.nr-line[data-who="agent"] .nr-bubble', (els) => els.map((e) => e.innerText.trim()));

let sid = null;
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('button.nr-chip[lang="en"]');
  const sessionResp = page.waitForResponse((r) => r.url().includes("/api/session") && r.request().method() === "POST", { timeout: 45000 });
  await page.click("button.nr-btn--go");
  sid = (await (await sessionResp).json()).sid;
  result.sid = sid;
  await until("the greeting", async () => (await agentLines()).length > 0, 45000);
  const before = (await agentLines()).length;

  await page.click("text=Show the strip to the camera");
  await page.waitForSelector("video.nr-strip__video", { timeout: 15000 });
  try {
    await until("the camera picture", () => page.$eval("video.nr-strip__video", (v) => v.videoWidth > 0), 15000);
  } catch (e) {
    result.video = await page.$eval("video.nr-strip__video", (v) => ({
      readyState: v.readyState,
      paused: v.paused,
      muted: v.muted,
      tracks: v.srcObject ? v.srcObject.getVideoTracks().map((t) => ({ state: t.readyState, enabled: t.enabled, muted: t.muted, label: t.label })) : null,
      error: v.error && v.error.message,
    }));
    result.fakeCamera = await page.evaluate(() => window.__fakeCam ?? null);
    throw e;
  }
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, "1-camera.png") });
  const t0 = Date.now();
  await page.click("text=Take photo");
  const msg = await until("the strip reading", () => page.$eval(".nr-strip__msg", (e) => e.innerText).catch(() => null), 45000);
  result.readAfterMs = Date.now() - t0;
  result.stripMessage = msg;
  if (!/telmisartan/i.test(msg) || !/40/.test(msg)) failures.push(`strip read as: ${msg}`);
  if (!/66/.test(msg)) failures.push(`strip price not read: ${msg}`);
  const said = await until(
    "the agent saying what it read",
    async () => (await agentLines()).slice(before).find((l) => /telmisartan/i.test(l)),
    30000,
  );
  result.agentSaid = said;
  await page.screenshot({ path: path.join(OUT, "2-read.png") });

  await page.fill("form.nr-type input", "One a day.");
  await page.click("form.nr-type button");
  const s = await until(
    "the medicine checked with the strip's price",
    async () => {
      const st = await state(sid);
      return st.meds?.find((m) => m.ja?.code === "300" && m.monthlyBrand) ? st : null;
    },
    60000,
  );
  const med = s.meds.find((m) => m.ja?.code === "300");
  result.med = { brand: med.brand, composition: med.composition, brandPrice: med.brandPrice, brandPack: med.brandPack, monthlyBrand: med.monthlyBrand, monthlyJa: med.monthlyJa, monthlySaving: med.monthlySaving };
  if (Math.round(med.monthlyBrand) !== 198) failures.push(`monthly brand cost ${med.monthlyBrand}, expected 198 (Rs 66 for 10, one a day)`);
  if (Math.round(med.monthlyJa) !== 37) failures.push(`monthly Jan Aushadhi cost ${med.monthlyJa}, expected 37`);
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, "3-matched.png"), fullPage: true });
  result.transcript = await page.$$eval(".nr-line", (els) => els.map((e) => `${e.getAttribute("data-who")}: ${e.innerText.trim()}`));
} catch (e) {
  failures.push(String(e?.message || e));
  await page.screenshot({ path: path.join(OUT, "failed.png"), fullPage: true }).catch(() => {});
} finally {
  if (sid) await fetch(`${BASE}/api/session?sid=${sid}`, { method: "DELETE" }).catch(() => {});
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(result, null, 1));
}

console.log(`Strip read in ${result.readAfterMs ?? "?"} ms: ${result.stripMessage ?? "-"}`);
console.log(`Agent said: ${result.agentSaid ?? "-"}`);
if (result.med) console.log(`Matched: ${result.med.brand} = ${result.med.composition}; Rs ${result.med.monthlyBrand} -> Rs ${result.med.monthlyJa} a month`);
console.log(`Output: ${OUT}`);
console.log(failures.length ? `\nstrip path: ${failures.length} failure(s)\n  - ${failures.join("\n  - ")}` : "\nstrip path: the strip was read, spoken and matched");
process.exit(failures.length ? 1 : 0);
