// Matching a medicine (by its ingredients, strength, form and release type) against the
// government's Jan Aushadhi product list. Matching is strict on purpose: same ingredients,
// same strength, same form and same release type. Anything else is reported, never suggested.
import productsData from "@/data/products.json";

export interface Product {
  code: string; // PMBJP drug code, printed on the list a pharmacist uses
  name: string; // generic name exactly as on the official list
  unit: string; // pack size as listed, e.g. "10's", "60 ml"
  mrp: number | null; // rupees per pack; null when the list shows no price
  group: string;
}

export type Form =
  | "tablet"
  | "capsule"
  | "syrup"
  | "suspension"
  | "injection"
  | "cream"
  | "gel"
  | "ointment"
  | "drops"
  | "inhaler"
  | "powder"
  | "other";
export type Release = "normal" | "extended" | "delayed" | "dispersible";

export interface QueryIngredient {
  name: string;
  strength: number;
  unit: string; // mg | mcg | g | iu | %
}

interface ParsedIngredient {
  key: string;
  amount: number | null; // normalised: mg for mass units, raw for iu and %
  dim: "mass" | "iu" | "pct" | null;
}

export interface ParsedProduct extends Product {
  ingredients: ParsedIngredient[];
  form: Form;
  release: Release;
  packCount: number | null;
}

const SALT_WORDS = new Set([
  "hydrochloride",
  "hcl",
  "sodium",
  "potassium",
  "calcium",
  "magnesium",
  "besylate",
  "besilate",
  "maleate",
  "succinate",
  "tartrate",
  "bitartrate",
  "bisulphate",
  "bisulfate",
  "mesylate",
  "mesilate",
  "fumarate",
  "sulphate",
  "sulfate",
  "phosphate",
  "citrate",
  "acetate",
  "bromide",
  "hydrobromide",
  "dihydrate",
  "monohydrate",
  "trihydrate",
  "anhydrous",
  "medoxomil",
  "cilexetil",
  "dipropionate",
  "propionate",
  "furoate",
  "hyclate",
  "trihydrate",
]);

const SYNONYMS: Record<string, string> = {
  thyroxine: "levothyroxine",
  acetaminophen: "paracetamol",
  "acetylsalicylic acid": "aspirin",
  cholecalciferol: "vitamin d3",
  frusemide: "furosemide",
  glyburide: "glibenclamide",
  albuterol: "salbutamol",
  "valproic acid": "sodium valproate",
  valproate: "sodium valproate",
  "metformin hcl": "metformin",
};

const FORM_WORDS =
  /\b(film[- ]coated|uncoated|coated|chewable|tablets?|capsules?|soft gelatin|hard gelatin|oral|suspension|syrup|injection|infusion|cream|gel|ointment|lotion|drops?|eye|ear|nasal|spray|solution|powder|sachets?|granules|for|ip|bp|usp|i\.p\.|b\.p\.|paediatric|pediatric|dry|concentrate|vials?|prefilled|syringe|respules?|rotacaps?|inhalers?|metered|dose|aerosol|mouthwash|gargle|lozenges?|dispersible|orally|disintegrating|mouth|dissolving|prolonged|sustained|extended|controlled|modified|delayed|release|gastro[- ]resistant|enteric|immediate|each|contains?)\b/g;

const STRENGTH_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|gm|iu|i\.u\.|%)(?![a-z])/i;

function detectForm(s: string): Form {
  if (/inhal|rotacap|respule|nebuli[sz]|metered dose/.test(s)) return "inhaler";
  if (/tablet/.test(s)) return "tablet";
  if (/capsule/.test(s)) return "capsule";
  if (/syrup/.test(s)) return "syrup";
  if (/suspension/.test(s)) return "suspension";
  if (/injection|infusion|vial/.test(s)) return "injection";
  if (/cream/.test(s)) return "cream";
  if (/\bgel\b/.test(s)) return "gel";
  if (/ointment/.test(s)) return "ointment";
  if (/drops?\b/.test(s)) return "drops";
  if (/powder|sachet|granules/.test(s)) return "powder";
  return "other";
}

function detectRelease(s: string): Release {
  if (
    /(prolonged|sustained|extended|controlled|modified)[ -]release|\((sr|er|xr|cr|mr|pr)\)|\b(sr|er|xr|cr|mr|pr)\b/.test(s)
  )
    return "extended";
  if (/gastro[- ]resistant|delayed[- ]release|enteric[- ]coated|\((dr|ec|gr)\)|\b(dr|ec|gr)\b/.test(s)) return "delayed";
  if (/orally disintegrating|dispersible|mouth dissolving|\b(odt|dt|md)\b/.test(s)) return "dispersible";
  return "normal";
}

export function normaliseIngredient(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (SYNONYMS[s]) s = SYNONYMS[s];
  const words = s.split(" ").filter(Boolean);
  // Drop salt words that follow the drug name ("metformin hydrochloride" -> "metformin"),
  // but keep a leading one ("sodium valproate", "calcium carbonate").
  const kept = words.filter((w, i) => i === 0 || !SALT_WORDS.has(w));
  s = kept.join(" ");
  if (SYNONYMS[s]) s = SYNONYMS[s];
  return s;
}

function toAmount(value: number, unitRaw: string): { amount: number; dim: ParsedIngredient["dim"] } {
  const u = unitRaw.toLowerCase().replace(/\./g, "");
  if (u === "mcg" || u === "µg") return { amount: value / 1000, dim: "mass" };
  if (u === "g" || u === "gm") return { amount: value * 1000, dim: "mass" };
  if (u === "mg") return { amount: value, dim: "mass" };
  if (u === "iu") return { amount: value, dim: "iu" };
  if (u === "%") return { amount: value, dim: "pct" };
  return { amount: value, dim: null };
}

export function parseProduct(p: Product): ParsedProduct {
  const lower = p.name.toLowerCase();
  const form = detectForm(lower);
  const release = detectRelease(lower);
  const stripped = lower
    .replace(/\((sr|er|xr|cr|mr|pr|dr|ec|gr)\)/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(FORM_WORDS, " ")
    .replace(/\bper\s+\d+(\.\d+)?\s*(ml|g|gm)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = stripped
    .split(/\s+and\s+|,|\+|\bwith\b/)
    .map((x) => x.trim())
    .filter(Boolean);
  const ingredients: ParsedIngredient[] = [];
  for (const part of parts) {
    const m = part.match(STRENGTH_RE);
    const name = part.replace(STRENGTH_RE, " ").replace(/\b\d+(\.\d+)?\s*(ml|w\/w|w\/v)?\b/g, " ").replace(/\s+/g, " ").trim();
    if (!name) {
      // a bare strength ("40 mg") belongs to the previous ingredient
      if (m && ingredients.length && ingredients[ingredients.length - 1].amount === null) {
        const a = toAmount(parseFloat(m[1]), m[2]);
        ingredients[ingredients.length - 1].amount = a.amount;
        ingredients[ingredients.length - 1].dim = a.dim;
      }
      continue;
    }
    const a = m ? toAmount(parseFloat(m[1]), m[2]) : { amount: null, dim: null };
    ingredients.push({ key: normaliseIngredient(name), amount: a.amount, dim: a.dim });
  }
  const pm = p.unit.match(/^(\d+)\s*'?s\b/i);
  return { ...p, ingredients, form, release, packCount: pm ? parseInt(pm[1], 10) : null };
}

export const PRODUCTS: ParsedProduct[] = (productsData as Product[]).map(parseProduct);

function sameKey(a: string, b: string): boolean {
  if (a === b) return true;
  const wa = ` ${a} `;
  const wb = ` ${b} `;
  return wa.includes(wb) || wb.includes(wa);
}

function sameIngredientSet(p: ParsedIngredient[], q: ParsedIngredient[]): boolean {
  if (p.length !== q.length) return false;
  const used = new Set<number>();
  return q.every((qi) => {
    const idx = p.findIndex((pi, i) => !used.has(i) && sameKey(pi.key, qi.key));
    if (idx < 0) return false;
    used.add(idx);
    return true;
  });
}

function sameStrengths(p: ParsedIngredient[], q: ParsedIngredient[]): boolean {
  return q.every((qi) => {
    const pi = p.find((x) => sameKey(x.key, qi.key));
    if (!pi || pi.amount === null || qi.amount === null) return false;
    return pi.dim === qi.dim && Math.abs(pi.amount - qi.amount) < 1e-6;
  });
}

export interface MatchResult {
  status: "exact" | "near" | "other_strengths" | "none";
  exact: ParsedProduct[];
  near: { product: ParsedProduct; differs: string }[];
  otherStrengths: ParsedProduct[];
}

export function findMatches(q: { ingredients: QueryIngredient[]; form: Form; release: Release }): MatchResult {
  const qi: ParsedIngredient[] = q.ingredients.map((i) => {
    const a = toAmount(i.strength, i.unit);
    return { key: normaliseIngredient(i.name), amount: a.amount, dim: a.dim };
  });
  const sameSet = PRODUCTS.filter((p) => sameIngredientSet(p.ingredients, qi));
  const sameStrength = sameSet.filter((p) => sameStrengths(p.ingredients, qi));
  const byPrice = (a: ParsedProduct, b: ParsedProduct) => unitPrice(a) - unitPrice(b);
  const exact = sameStrength.filter((p) => p.form === q.form && p.release === q.release).sort(byPrice);
  const near = sameStrength
    .filter((p) => !exact.includes(p))
    .map((p) => ({
      product: p,
      differs: [p.form !== q.form ? `form is ${p.form}, not ${q.form}` : "", p.release !== q.release ? `release is ${p.release}, not ${q.release}` : ""]
        .filter(Boolean)
        .join("; "),
    }));
  const otherStrengths = sameSet.filter((p) => !sameStrength.includes(p));
  const status = exact.length ? "exact" : near.length ? "near" : otherStrengths.length ? "other_strengths" : "none";
  return { status, exact, near, otherStrengths };
}

export function unitPrice(p: Product & { packCount: number | null }): number {
  if (p.mrp === null || !p.packCount) return Number.POSITIVE_INFINITY;
  return p.mrp / p.packCount;
}

export function productByCode(code: string): ParsedProduct | undefined {
  return PRODUCTS.find((p) => p.code === String(code));
}

export function describe(p: ParsedProduct) {
  return {
    code: p.code,
    name: p.name,
    pack: p.unit,
    mrp_rupees: p.mrp,
    price_per_unit: p.packCount && p.mrp !== null ? Math.round((p.mrp / p.packCount) * 100) / 100 : null,
    form: p.form,
    release: p.release,
  };
}

export const DAYS_PER_MONTH = 30;

export function monthlyCost(pricePerPack: number, packCount: number, dosesPerDay: number): number {
  return Math.round((pricePerPack / packCount) * dosesPerDay * DAYS_PER_MONTH * 100) / 100;
}
