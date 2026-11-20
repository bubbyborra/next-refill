// A sample call for the "?state=" views and the no-microphone demo. Every number comes from a
// real test call on the live site (21 Nov 2026, typed in Telugu); it is always shown with a
// "Sample" label, never as a live call.
import type { PublicState, Line } from "@/components/useCall";

export const SAMPLE_LINES: Line[] = [
  { key: "a1", who: "agent", final: true, text: "నమస్కారం! మీరు ప్రతి నెలా కొనే మందుల పేర్లు చెప్పండి: స్ట్రిప్ మీద ఉన్న పేరు, రోజుకు ఎన్ని, ధర ఎంత." },
  { key: "u1", who: "you", final: true, text: "మా నాన్నగారు Telma 40 రోజుకు ఒకటి, Glycomet 500 రోజుకు రెండు వేసుకుంటారు. Telma 30 టాబ్లెట్లు 230 రూపాయలు, Glycomet 10 టాబ్లెట్లు 25 రూపాయలు." },
  { key: "a2", who: "agent", final: true, text: "Telma 40 అంటే Telmisartan 40 mg; స్ట్రిప్ మీద అదే ఉందో చూడండి. జన ఔషధిలో నెలకు 37 రూపాయలు, ఇప్పుడు 230, అంటే 193 రూపాయలు మిగులుతాయి." },
  { key: "a3", who: "agent", final: true, text: "Glycomet 500 అంటే Metformin 500 mg. జన ఔషధిలో నెలకు 41 రూపాయలు, ఇప్పుడు 150, అంటే 109 రూపాయలు మిగులుతాయి. ఇంకా ఏవైనా మందులు ఉన్నాయా?" },
  { key: "u2", who: "you", final: true, text: "అంతే. మేము Brookefield, Bengaluru లో ఉంటాం." },
  { key: "a4", who: "agent", final: true, text: "రెండు మందులు కలిపి నెలకు 302 రూపాయలు, సంవత్సరానికి 3624 రూపాయలు మిగులుతాయి. దగ్గరలో ఉన్న స్టోర్ Vibhuthipura లో, Basavanagar Main road మీద, సుమారు 2 కిలోమీటర్లు." },
  { key: "u3", who: "you", final: true, text: "సరే, ఫోన్‌కి పంపండి." },
  { key: "a5", who: "agent", final: true, text: "మీ ఫోన్‌కు లిస్ట్, స్టోర్ దారి వివరాలు వెళ్లాయి. మొదటి రిఫిల్ రిమైండర్ డిసెంబర్ 18న వస్తుంది." },
];

const T = Date.parse("2026-11-21T03:00:00+05:30");

export const SAMPLE_STATE: PublicState = {
  sid: "sample",
  lang: "te",
  createdAt: T,
  channel: "sample",
  userUid: 0,
  agentUid: 0,
  meds: [
    {
      id: "telma-40",
      brand: "Telma 40",
      forWhom: "father",
      ingredients: [{ name: "Telmisartan", strength: 40, unit: "mg" }],
      composition: "Telmisartan 40 mg",
      form: "tablet",
      release: "normal",
      dosesPerDay: 1,
      brandPrice: 230,
      brandPack: 30,
      ja: { code: "300", name: "Telmisartan Tablets IP 40mg", unit: "10's", mrp: 12.38, packCount: 10 },
      status: "matched",
      monthlyBrand: 230,
      monthlyJa: 37.14,
      monthlySaving: 192.86,
      daysPerPack: 30,
    },
    {
      id: "glycomet-500",
      brand: "Glycomet 500",
      forWhom: "father",
      ingredients: [{ name: "Metformin Hydrochloride", strength: 500, unit: "mg" }],
      composition: "Metformin Hydrochloride 500 mg",
      form: "tablet",
      release: "normal",
      dosesPerDay: 2,
      brandPrice: 25,
      brandPack: 10,
      ja: { code: "145", name: "Metformin Hydrochloride Tablets IP 500mg", unit: "10's", mrp: 6.81, packCount: 10 },
      status: "matched",
      monthlyBrand: 150,
      monthlyJa: 40.86,
      monthlySaving: 109.14,
      daysPerPack: 5,
    },
  ],
  location: { lat: 12.9662, lon: 77.7186, label: "Brookefield, Bengaluru", source: "spoken" },
  stores: [
    {
      name: "Jan Aushadhi Kendra",
      address: "No.166, Vibhuthipura, Basavanagar Main road, Bengaluru 560037",
      pincode: "560037",
      lat: 12.9634,
      lon: 77.6986,
      km: 2.1,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Vibhuthipura%20Basavanagar%20Main%20road%20Bengaluru%20560037",
    },
  ],
  sent: { at: T + 120_000, reminders: [{ medId: "telma-40", brand: "Telma 40", date: "2026-12-18" }, { medId: "glycomet-500", brand: "Glycomet 500", date: "2026-12-18" }] },
  activity: [
    { t: T, text: "Call started in Telugu" },
    { t: T + 20_000, text: "Found Telmisartan 40 mg on the Jan Aushadhi list (code 300): Rs 230 a month now, Rs 37 there" },
    { t: T + 21_000, text: "Found Metformin 500 mg on the Jan Aushadhi list (code 145): Rs 150 a month now, Rs 41 there" },
    { t: T + 60_000, text: "Nearest Jan Aushadhi store: Vibhuthipura, Basavanagar Main road, 2.1 km" },
    { t: T + 120_000, text: "Sent the list to the phone, with a refill reminder on 18 Dec 2026" },
  ],
  totals: { monthlyBrand: 380, monthlyJa: 78, monthlySaving: 302, yearlySaving: 3624, pricedCount: 2 },
};
