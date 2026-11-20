// The matcher on 20 common chronic-disease medicines (composition as printed on Indian strips),
// with the expected result for each. Exits 1 if any result changes.
// Shelcal 500 is a known miss: the strip says calcium carbonate 1250 mg, the list says calcium 500 mg.
// Janumet 50/500 must stay "near": the list only has the extended-release version.
import { findMatches, type Form, type Release } from "../src/lib/products";

type Q = [string, [string, number, string][], Form, Release];
const EXPECT: Record<string, [string, string | null]> = {"Telma 40": ["exact", "300"], "Glycomet 500": ["exact", "145"], "Glycomet 500 SR": ["exact", "372"], "Thyronorm 50": ["exact", "1221"], "Amlong 5": ["exact", "264"], "Atorva 10": ["exact", "266"], "Rosuvas 10": ["exact", "759"], "Pan 40": ["exact", "212"], "Dolo 650": ["exact", "511"], "Glycomet GP 1": ["exact", "904"], "Telma H": ["exact", "298"], "Ecosprin 75": ["exact", "790"], "Clopilet 75": ["exact", "269"], "Losar 50": ["exact", "289"], "Metolar XR 50": ["exact", "291"], "Montair LC": ["exact", "252"], "Azithral 500": ["exact", "72"], "Uprise D3 60K": ["exact", "2047"], "Shelcal 500": ["other_strengths", null], "Janumet 50/500": ["near", null]};
let failed = 0;
const cases: Q[] = [
  ["Telma 40", [["Telmisartan", 40, "mg"]], "tablet", "normal"],
  ["Glycomet 500", [["Metformin Hydrochloride", 500, "mg"]], "tablet", "normal"],
  ["Glycomet 500 SR", [["Metformin", 500, "mg"]], "tablet", "extended"],
  ["Thyronorm 50", [["Thyroxine Sodium", 50, "mcg"]], "tablet", "normal"],
  ["Amlong 5", [["Amlodipine", 5, "mg"]], "tablet", "normal"],
  ["Atorva 10", [["Atorvastatin", 10, "mg"]], "tablet", "normal"],
  ["Rosuvas 10", [["Rosuvastatin", 10, "mg"]], "tablet", "normal"],
  ["Pan 40", [["Pantoprazole", 40, "mg"]], "tablet", "delayed"],
  ["Dolo 650", [["Paracetamol", 650, "mg"]], "tablet", "normal"],
  ["Glycomet GP 1", [["Glimepiride", 1, "mg"], ["Metformin", 500, "mg"]], "tablet", "extended"],
  ["Telma H", [["Telmisartan", 40, "mg"], ["Hydrochlorothiazide", 12.5, "mg"]], "tablet", "normal"],
  ["Ecosprin 75", [["Aspirin", 75, "mg"]], "tablet", "delayed"],
  ["Clopilet 75", [["Clopidogrel", 75, "mg"]], "tablet", "normal"],
  ["Losar 50", [["Losartan Potassium", 50, "mg"]], "tablet", "normal"],
  ["Metolar XR 50", [["Metoprolol Succinate", 50, "mg"]], "tablet", "extended"],
  ["Montair LC", [["Montelukast", 10, "mg"], ["Levocetirizine", 5, "mg"]], "tablet", "normal"],
  ["Azithral 500", [["Azithromycin", 500, "mg"]], "tablet", "normal"],
  ["Uprise D3 60K", [["Cholecalciferol", 60000, "iu"]], "capsule", "normal"],
  ["Shelcal 500", [["Calcium Carbonate", 1250, "mg"], ["Vitamin D3", 250, "iu"]], "tablet", "normal"],
  ["Janumet 50/500", [["Sitagliptin", 50, "mg"], ["Metformin", 500, "mg"]], "tablet", "normal"],
];
for (const [brand, ings, form, release] of cases) {
  const r = findMatches({ ingredients: ings.map(([name, strength, unit]) => ({ name, strength, unit })), form, release });
  const top = r.exact[0] ?? r.near[0]?.product;
  const extra = r.status === "near" ? ` [${r.near[0].differs}]` : r.status === "other_strengths" ? ` [other: ${r.otherStrengths.slice(0, 2).map((p) => p.name).join("; ")}]` : "";
  const [wantStatus, wantCode] = EXPECT[brand];
  const ok = r.status === wantStatus && (!wantCode || top?.code === wantCode);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.status.padEnd(15)} ${brand.padEnd(16)} -> ${top ? `${top.code} ${top.name} | ${top.unit} | ₹${top.mrp}` : "-"}${extra}`);
}
console.log(failed ? `check_matcher: ${failed} result(s) changed` : `check_matcher: all 20 as expected`);
process.exit(failed ? 1 : 0);
