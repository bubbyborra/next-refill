# Wahi Dawa

**Same medicine. Jan Aushadhi price.**

Wahi Dawa is a voice agent you talk to in your own language: Telugu, Tamil, Hindi, English, Kannada, Malayalam, Bengali, Marathi or Gujarati. Tell it the tablets you buy every month, by the name on the strip. It finds the exact same composition in the government's Jan Aushadhi list, says what you'd pay there and what you'd save each month, finds the nearest Jan Aushadhi Kendra, and puts the list, directions and monthly refill reminders on your phone.

Built for Track 5, Voice AI for Bharat, at Build with Agora – Bengaluru 2026, on Agora Conversational AI and Murf Falcon.

## Why

Jan Aushadhi Kendras sell generic medicines from the government's PMBJP scheme. The official Product & MRP List has 2,453 products (2,100 with a price), and the Locate Kendra list has 21,891 stores across India, 528 of them in Bengaluru Urban (both read from janaushadhi.gov.in on 20 Nov 2026).

But people buy medicines by brand name. The generic name is in small English print on the back of the strip, and the price comparison is per tablet, per pack size. Say "Telma 40" in Telugu and you need to know it's Telmisartan 40 mg, that Jan Aushadhi lists Telmisartan Tablets IP 40mg at ₹12.38 for 10 (drug code 300), and how that compares with what you pay. Wahi Dawa does that part, by voice.

## Try it in 30 seconds

1. Open the live app, pick your language and press **Start talking**.
2. Say a medicine you buy, how many a day, and the strip's price, e.g. "Telma 40, one a day, 230 rupees for 30" (illustrative price).
3. Hear the saving, then say your area. Say "yes" when it offers to send the list, and scan the QR code.

## What a call does

- **Understands the strip name.** It works out the composition from the brand, says it back so you can check it against the strip, or reads the strip through the camera ("Show the strip").
- **Checks the official list.** A match needs the same ingredients, strength, form and release type (SR, gastro-resistant, dispersible). Anything else is reported, never suggested. It never changes a medicine, strength or dose.
- **Works out the saving** from the price you said (or the strip photo) and the Jan Aushadhi MRP, per month and per year.
- **Finds the nearest Kendra** from the official store list.
- **Sends it to your phone**, only after you say yes: the generic name and drug code to show the pharmacist, directions, a WhatsApp share and monthly refill reminders (a calendar file).

## How it uses Agora and Murf

- **Agora Conversational AI Engine** (official `agora-agents` SDK): one agent per call, with Sarvam speech-to-text in the caller's language, our own model endpoint and a Murf Falcon voice. [`src/lib/agora.ts`](src/lib/agora.ts)
- **Custom model endpoint**: Agora calls `/api/llm` as an OpenAI-style streaming endpoint. It runs the model with four tools that work on the official lists, and says a short "one moment" in the caller's language while it checks. [`src/app/api/llm/route.ts`](src/app/api/llm/route.ts), [`src/lib/tools.ts`](src/lib/tools.ts)
- **Agora RTC and RTM**: the browser's microphone audio, the live transcript and the agent's listening/thinking/speaking state. [`src/components/useCall.ts`](src/components/useCall.ts)
- **Agora speak API**: after a strip photo is read, the agent says what it saw on the call. [`src/app/api/strip/route.ts`](src/app/api/strip/route.ts)
- **Murf Falcon voices**: a native voice per language where Murf has one (Tamil, Hindi, Kannada, Malayalam, Bengali, Marathi, Gujarati), and a multilingual voice speaking Telugu. [`src/lib/languages.ts`](src/lib/languages.ts)

The model behind the agent is Claude (Anthropic), with reasoning turned off so it answers quickly on a call.

## Check it yourself

- Matching on 20 common chronic-disease medicines, entered by the composition printed on the strip: `npx tsx scripts/check_matcher.ts`. Result on 20 Nov 2026: 18 exact matches; Janumet 50/500 was correctly *not* matched (Jan Aushadhi lists only the extended-release version); Shelcal 500 was missed because the list states calcium as 500 mg elemental calcium while the strip says 1250 mg calcium carbonate.
- Data, with sources: [`data/source/`](data/source). Rebuild with `python3 scripts/build_products.py data/source/pmbi-product-mrp-list.tsv` and `python3 scripts/build_stores.py`.

## What doesn't work yet

- Stores cover Bengaluru Urban only (525 of the 528 listed have coordinates). Distances are measured from the centre of each store's PIN code, so they're approximate.
- 353 products on the official list show no price yet ("under process"); for those it says the price isn't listed.
- The brand-to-composition step uses the model's knowledge of Indian brands. That's why it asks you to check the strip, and why the camera reads the strip directly.
- It can't order medicines or check a store's stock: there's no public API for either.
- The greetings in Kannada, Malayalam, Bengali, Marathi and Gujarati haven't been checked by native speakers yet.
- Not medical advice. It only compares prices for the same composition; show the list to your pharmacist, and to your doctor if in doubt.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev -- --port 3440
cloudflared tunnel --url http://localhost:3440   # Agora must reach /api/llm; put the URL in PUBLIC_BASE_URL
```

Needs an Agora project (App ID and certificate, Conversational AI enabled), a Murf API key, a Sarvam API key and an Anthropic API key.
