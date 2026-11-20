// Our own break test of the main claim: "it only matches the same ingredients, strength,
// form and release type". Two parts:
//  1. Hand-written traps (wrong strength, wrong form, wrong release, unknown drug, unit
//     conversions, combination order). Each has an expected outcome; any miss fails.
//  2. A sweep over every product on the official list: query each tablet or capsule with
//     its own printed composition (it should find itself), and with each strength doubled
//     (it must never return an exact match with a different strength).
// Usage: npx tsx scripts/break_test.ts   (exits 1 on any failure)
import { PRODUCTS, findMatches, type Form, type QueryIngredient, type Release } from "../src/lib/products";

type Expect = "exact" | "near" | "other_strengths" | "none";
interface Trap {
  name: string;
  ingredients: [string, number, string][];
  form: Form;
  release: Release;
  expect: Expect;
  code?: string; // when exact, the drug code it must return first
}

const traps: Trap[] = [
  { name: "strength that isn't listed (telmisartan 30)", ingredients: [["Telmisartan", 30, "mg"]], form: "tablet", release: "normal", expect: "other_strengths" },
  { name: "metformin 500 plain", ingredients: [["Metformin Hydrochloride", 500, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "145" },
  { name: "metformin 500 SR is not the plain one", ingredients: [["Metformin", 500, "mg"]], form: "tablet", release: "extended", expect: "exact", code: "372" },
  { name: "pantoprazole asked as plain (list has gastro-resistant)", ingredients: [["Pantoprazole", 40, "mg"]], form: "tablet", release: "normal", expect: "near" },
  { name: "atorvastatin asked as capsule (list has tablet)", ingredients: [["Atorvastatin", 10, "mg"]], form: "capsule", release: "normal", expect: "near" },
  { name: "combination in the other order", ingredients: [["Amlodipine", 5, "mg"], ["Telmisartan", 40, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "417" },
  { name: "thyroxine 0.05 mg is 50 mcg", ingredients: [["Levothyroxine", 0.05, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "1221" },
  { name: "made-up drug", ingredients: [["Xyzzolol", 10, "mg"]], form: "tablet", release: "normal", expect: "none" },
  { name: "paracetamol 650", ingredients: [["Paracetamol", 650, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "511" },
  { name: "paracetamol 625 isn't 650", ingredients: [["Paracetamol", 625, "mg"]], form: "tablet", release: "normal", expect: "other_strengths" },
  { name: "glimepiride + metformin plain (list has metformin prolonged-release)", ingredients: [["Glimepiride", 1, "mg"], ["Metformin", 500, "mg"]], form: "tablet", release: "normal", expect: "near" },
  { name: "telmisartan 40 alone isn't Telma H, the combination", ingredients: [["Telmisartan", 40, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "300" },
  { name: "hydrochlorothiazide 12.5 alone is listed on its own", ingredients: [["Hydrochlorothiazide", 12.5, "mg"]], form: "tablet", release: "normal", expect: "exact", code: "912" },
  { name: "acetaminophen is paracetamol", ingredients: [["Acetaminophen", 500, "mg"]], form: "tablet", release: "normal", expect: "exact" },
  { name: "sitagliptin + metformin plain (list has extended-release)", ingredients: [["Sitagliptin", 50, "mg"], ["Metformin", 500, "mg"]], form: "tablet", release: "normal", expect: "near" },
];

let failures = 0;
console.log("Traps:");
for (const t of traps) {
  const q = { ingredients: t.ingredients.map(([name, strength, unit]) => ({ name, strength, unit })) as QueryIngredient[], form: t.form, release: t.release };
  const r = findMatches(q);
  const okStatus = r.status === t.expect;
  const okCode = !t.code || r.exact[0]?.code === t.code;
  // an exact match never has a different number of ingredients than the query
  const okCount = r.exact.every((p) => p.ingredients.length === q.ingredients.length);
  const ok = okStatus && okCode && okCount;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${t.name}: ${r.status}${r.exact[0] ? ` (code ${r.exact[0].code})` : ""}${ok ? "" : ` — expected ${t.expect}${t.code ? ` code ${t.code}` : ""}`}`);
}

// Sweep: every priced tablet or capsule whose name parses into ingredients with strengths.
let n = 0;
let selfFound = 0;
let falseExact = 0;
for (const p of PRODUCTS) {
  if (p.mrp === null || (p.form !== "tablet" && p.form !== "capsule")) continue;
  if (!p.ingredients.length || p.ingredients.some((i) => i.amount === null || i.dim === null)) continue;
  n++;
  const unit = (dim: string) => (dim === "mass" ? "mg" : dim === "iu" ? "iu" : "%");
  const own = p.ingredients.map((i) => ({ name: i.key, strength: i.amount!, unit: unit(i.dim!) }));
  const r = findMatches({ ingredients: own, form: p.form, release: p.release });
  if (r.exact.some((x) => x.code === p.code)) selfFound++;
  // doubled strengths must never come back as an exact match for this product
  const doubled = own.map((i) => ({ ...i, strength: i.strength * 2 }));
  const r2 = findMatches({ ingredients: doubled, form: p.form, release: p.release });
  if (r2.exact.some((x) => x.code === p.code)) falseExact++;
}
console.log(`\nSweep over the official list: ${n} priced tablets and capsules with a parsed composition`);
console.log(`  found itself from its own composition: ${selfFound} of ${n}`);
console.log(`  exact match returned for a doubled strength (must be 0): ${falseExact}`);
if (falseExact > 0) failures++;

console.log(failures ? `\nbreak test: ${failures} failure(s)` : "\nbreak test: all traps behaved, no false exact matches");
process.exit(failures ? 1 : 0);
