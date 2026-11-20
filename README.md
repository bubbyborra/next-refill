# Next Refill

**Same medicine. Jan Aushadhi price.**

![A spoken Telugu call on the live site: Telma 40 and Glycomet 500 matched to Jan Aushadhi drug codes 300 and 145, saving ₹302 a month, nearest store found, list sent to the phone](docs/core-loop.gif)
<sub>A spoken call on the live site, sped up 5×. The caller is a synthetic Telugu voice from our test script (scripts/demo_path.mjs); the agent, the matching and the saving are live. Brand prices are as the caller said them.</sub>

Say the medicines you buy every month, in your own language, and Next Refill finds the exact same salt and strength on the government's Jan Aushadhi list, tells you what you'd save, and puts the list for the pharmacist on your phone.

It needs a real-time voice agent because the people it's for know their tablets by brand name and speak Telugu, Tamil, Hindi or Kannada, not the English fine print on the strip: Agora's Conversational AI runs the call and Murf's Falcon voices answer in their language.

**Live:** https://next-refill.vercel.app

## Try it in 30 seconds

1. Open the live app, pick your language and press **Start talking** (or type in the box if the room is noisy).
2. Say a medicine you buy, how many a day and the price on the strip, for example "Telma 40, one a day, 230 rupees for 30" (an illustrative price).
3. Hear the saving. Say your area, say "yes" when it offers to send the list, and scan the QR code: the list for the pharmacist, directions, refill reminders and a voice note in your language.

## Why it matters

- About 315 million adults in India have high blood pressure and 101 million have diabetes ([ICMR-INDIAB, 2023](https://nmji.in/lessons-learnt-from-the-icmrindiab-study)), and their families buy the same tablets every month.
- Households still pay 39.4% of India's health spending out of their own pockets ([National Health Accounts 2021-22, PIB](https://pib.gov.in/PressReleasePage.aspx?PRID=2114761)).
- Jan Aushadhi prices are "generally 50–80% lower than those of comparable branded medicines" ([PIB, March 2026](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/mar/doc202637814101.pdf)). A nine-state study found out-of-pocket spending 60.6% to 89.3% lower for those who bought only at Kendras, but use stays "limited, mainly due to low awareness, perceived stock shortages and low rates of generic prescribing" ([BMJ Open, 2026](https://doi.org/10.1136/bmjopen-2025-113839)).

Next Refill works on the first of those: it turns the brand name a family knows, said in their own language, into the exact generic and its drug code.

## What a call does

- **Understands the strip name.** It works out the composition from the brand and says it back so you can check it against the strip, or reads the strip through the camera.
- **Checks the official list.** A match needs the same ingredients, strength, form and release type (SR, gastro-resistant, dispersible). Anything else is reported, never suggested. It never changes a medicine, strength or dose.
- **Works out the saving** from the price you said (or the strip photo) and the Jan Aushadhi MRP, per month and per year.
- **Finds the nearest Kendra** from the official store list.
- **Sends it to your phone**, only after you say yes: the generic name and drug code for the pharmacist, directions, a WhatsApp share and monthly refill reminders.
- **Reads it out:** "Listen" on the phone plays the list as a short voice note in your language, in the same voice as the call.
- **Works in a noisy room:** "Type instead" sends a typed line through the same agent, and the agent still says the reply.

## How it uses Agora and Murf

- **Agora Conversational AI Engine** (the official `agora-agents` SDK): one agent per call, with Sarvam speech-to-text in the caller's language, our own model endpoint and a Murf Falcon voice. [`src/lib/agora.ts`](src/lib/agora.ts)
- **Custom model endpoint:** Agora calls `/api/llm` as an OpenAI-style streaming endpoint. It runs an AI model with four tools that work on the official lists, and says a short "one moment" in the caller's language while it checks. [`src/server/llm.ts`](src/server/llm.ts), [`src/lib/tools.ts`](src/lib/tools.ts)
- **Agora RTC and RTM:** the browser's microphone audio, the live transcript and the agent's listening, checking and speaking state. [`src/components/useCall.ts`](src/components/useCall.ts)
- **Agora speak API:** after a strip photo is read, the agent says what it saw on the call; typed lines are answered the same way. [`src/server/strip.ts`](src/server/strip.ts), [`src/server/type.ts`](src/server/type.ts)
- **Murf Falcon voices:** a native voice for Tamil, Hindi, Kannada, Malayalam, Bengali, Marathi and Gujarati, and a multilingual voice speaking Telugu and English. The phone page's voice note uses Murf's streaming endpoint with the same voice. [`src/lib/languages.ts`](src/lib/languages.ts), [`src/server/voice.ts`](src/server/voice.ts)

## Evidence

> Evidence, stated plainly: no real users yet; it was built for this hackathon. Instead: our own break test of the main claim, that it only ever matches the same medicine, run against the government's own list. It reruns from the repo with one command.

> Claim: Next Refill never returned an exact match at a different strength: 0 of 1,173 doubled-strength queries (95% interval 0.0% to 0.3%).
> Evidence type: Our own break test (we tried to make it fail), not real users.
> Data: PMBI's Product & MRP List (janaushadhi.gov.in, read 20 Nov 2026), every priced tablet and capsule whose name parses into ingredients, n = 1,173. Baseline: none published.
> Result: all 1,173 find themselves from their own composition (95% interval 99.7% to 100.0%), and all 15 hand-written traps behave (wrong strength, form or release type, unknown drugs, mcg against mg, combination order).
> Rerun: `npx tsx scripts/break_test.ts` at commit 56b7702. Limits: our parser of the list's product names; tablets and capsules only; the step from brand name to composition (an AI model, or the strip photo) isn't covered.

The first run found a real bug, now fixed: two valproate combination tablets (codes 1806 and 1807) couldn't match themselves.

Limits, in numbers: zero real users; the break test covers matching only, not speech recognition or the brand step. On 20 common chronic medicines typed in by the composition on their strips (`npx tsx scripts/check_matcher.ts`), 18 matched exactly, Janumet was correctly not matched (the list has only the extended-release version) and Shelcal was missed (the strip says 1250 mg calcium carbonate, the list says 500 mg calcium).

## Check it yourself

- The live app: https://next-refill.vercel.app (a call works without a microphone too: type instead).
- The data, with sources: [`data/source/`](data/source). Rebuild with `python3 scripts/build_products.py data/source/pmbi-product-mrp-list.tsv` and `python3 scripts/build_stores.py`.
- All checks: `./check.sh` (types, the 20 medicines, the break test).
- A spoken call end to end on the live site: `npx playwright install chromium`, then `node scripts/demo_path.mjs https://next-refill.vercel.app te` (or `hi`). A synthetic caller's voice goes in as the microphone, and it checks every step: both medicines matched, the ₹302 saving, the store, the list sent, the phone page, the reminders file and the voice note. Each run is a real call of about two minutes.

## What doesn't work yet

- Stores cover Bengaluru Urban only (525 of the 528 listed have coordinates). Distances are measured from the centre of each store's PIN code, so they're approximate.
- 353 products on the official list show no price yet ("under process"); for those it says the price isn't listed.
- The brand-to-composition step uses an AI model's knowledge of Indian brands. That's why it asks you to check the strip, and why the camera reads the strip directly.
- It can't order medicines or check a store's stock: there's no public API for either.
- The lines in Kannada, Malayalam, Bengali, Marathi and Gujarati haven't been checked by native speakers yet.
- Spoken calls are tested end to end with synthetic voices in Telugu and Hindi (`scripts/demo_path.mjs`), not yet with many real speakers or in a noisy hall.
- Not medical advice. It only compares prices for the same composition; show the list to your pharmacist, and to your doctor if in doubt.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev -- --port 3440
cloudflared tunnel --url http://localhost:3440   # Agora must reach /api/llm; put the URL in PUBLIC_BASE_URL
```

Needs an Agora project (App ID and certificate, Conversational AI enabled), Murf, Sarvam and Anthropic API keys, and optionally Upstash Redis (needed when hosted on more than one server instance, as on Vercel).
