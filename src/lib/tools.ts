// The tools the voice agent can call. Each one validates its input, works on the call's
// state, records what it did (shown on screen as it happens) and returns JSON to the model.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describe, findMatches, monthlyCost, type Form, type Release } from "./products";
import { geocode, nearest } from "./stores";
import { logActivity, updateState, type CallState, type Med } from "./store";

const FORMS = ["tablet", "capsule", "syrup", "suspension", "injection", "cream", "gel", "ointment", "drops", "inhaler", "powder", "other"] as const;
const RELEASES = ["normal", "extended", "delayed", "dispersible"] as const;
const UNITS = ["mg", "mcg", "g", "iu", "%"] as const;

const ingredientSchema = {
  type: "array",
  description: "Every active ingredient with its strength, e.g. [{name:'Telmisartan', strength:40, unit:'mg'}]",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Generic (salt) name in English" },
      strength: { type: "number" },
      unit: { type: "string", enum: UNITS },
    },
    required: ["name", "strength", "unit"],
  },
};

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "check_medicine",
    description:
      "Check one medicine against the government's Jan Aushadhi (PMBJP) product list and add it to the caller's list. Call it as soon as you know the composition (salts and strengths, from the brand, the caller reading the strip, or a strip photo), the form, the release type and how many a day. Pass the strip's price and tablet count too if the caller gave them. Exact matches (same ingredients, strength, form and release type) are saved with the monthly cost and saving. Near matches (only form or release type differs) are NOT treated as the same medicine. Call it again with corrected details if the caller says the strip reads differently.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        brand_name: { type: "string", description: "Name on the strip as the caller said it, e.g. 'Telma 40'" },
        ingredients: ingredientSchema,
        form: { type: "string", enum: FORMS },
        release: { type: "string", enum: RELEASES, description: "extended = SR/ER/XR/CR/PR; delayed = gastro-resistant/EC/DR; dispersible = DT/ODT" },
        doses_per_day: { type: "number", description: "Units taken per day, e.g. 1, 2, 0.5" },
        brand_price_rupees: { type: "number", description: "Price of the caller's strip or box, if they said it" },
        brand_pack_count: { type: "number", description: "Tablets or capsules that price covers, if known" },
        for_whom: { type: "string", description: "Who takes it, if the caller said (e.g. 'father')" },
      },
      required: ["brand_name", "ingredients", "form", "release", "doses_per_day"],
    },
  } as Anthropic.Tool,
  {
    name: "remove_medicine",
    description: "Remove a medicine from the caller's list when they say it was a mistake.",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: { brand_name: { type: "string" } }, required: ["brand_name"] },
  } as Anthropic.Tool,
  {
    name: "find_nearest_store",
    description:
      "Find the nearest Jan Aushadhi stores. Uses the location the caller's browser shared if there is one; otherwise pass the area name or 6-digit PIN code the caller said.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { area_or_pincode: { type: "string", description: "e.g. 'Brookefield, Bengaluru' or '560037'" } },
    },
  } as Anthropic.Tool,
  {
    name: "send_list_to_phone",
    description:
      "Put the caller's switch list, store directions and monthly refill reminders on their phone (the QR code on screen). Only call this after the caller has clearly said yes to sending it.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { caller_confirmed: { type: "boolean", description: "true only if the caller said yes just now" } },
      required: ["caller_confirmed"],
    },
  } as Anthropic.Tool,
];

const Ingredient = z.object({ name: z.string().min(1), strength: z.number().positive(), unit: z.enum(UNITS) });
const FindInput = z.object({
  brand_name: z.string().min(1),
  ingredients: z.array(Ingredient).min(1),
  form: z.enum(FORMS),
  release: z.enum(RELEASES),
});
const SaveInput = FindInput.extend({
  doses_per_day: z.number().positive().max(12),
  brand_price_rupees: z.number().positive().optional(),
  brand_pack_count: z.number().positive().optional(),
  for_whom: z.string().optional(),
});
const RemoveInput = z.object({ brand_name: z.string().min(1) });
const StoreInput = z.object({ area_or_pincode: z.string().optional() });
const SendInput = z.object({ caller_confirmed: z.boolean() });

const money = (n: number) => Math.round(n);
const composition = (ings: { name: string; strength: number; unit: string }[]) =>
  ings.map((i) => `${i.name[0].toUpperCase()}${i.name.slice(1)} ${i.strength} ${i.unit}`).join(" + ");

export function totals(s: CallState) {
  const priced = s.meds.filter((m) => m.monthlySaving !== undefined);
  const brand = priced.reduce((a, m) => a + (m.monthlyBrand ?? 0), 0);
  const ja = priced.reduce((a, m) => a + (m.monthlyJa ?? 0), 0);
  return { monthlyBrand: money(brand), monthlyJa: money(ja), monthlySaving: money(brand - ja), yearlySaving: money((brand - ja) * 12), pricedCount: priced.length };
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function runTool(sid: string, name: string, raw: unknown): Promise<{ content: string; isError?: boolean }> {
  const bad = (e: z.ZodError) => ({ content: JSON.stringify({ error: "invalid input", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }), isError: true });

  if (name === "check_medicine") {
    const p = SaveInput.safeParse(raw);
    if (!p.success) return bad(p.error);
    const d = p.data;
    const r = findMatches({ ingredients: d.ingredients, form: d.form as Form, release: d.release as Release });
    const product = r.exact[0];
    let result: Record<string, unknown> = {};
    const s = await updateState(sid, (s) => {
      const id = d.brand_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const med: Med = {
        id,
        brand: d.brand_name,
        forWhom: d.for_whom,
        ingredients: d.ingredients,
        composition: composition(d.ingredients),
        form: d.form as Form,
        release: d.release as Release,
        dosesPerDay: d.doses_per_day,
        brandPrice: d.brand_price_rupees,
        brandPack: d.brand_pack_count,
        status: product ? "matched" : r.status === "near" ? "check" : "no_match",
      };
      if (product) {
        med.ja = { code: product.code, name: product.name, unit: product.unit, mrp: product.mrp, packCount: product.packCount };
        if (product.mrp !== null && product.packCount) med.monthlyJa = monthlyCost(product.mrp, product.packCount, d.doses_per_day);
        if (product.mrp === null) med.note = "Jan Aushadhi price not listed yet";
      } else if (r.status === "near") {
        med.note = `Jan Aushadhi lists it only as: ${r.near[0].product.name} (${r.near[0].differs})`;
      }
      if (d.brand_price_rupees && d.brand_pack_count) {
        med.monthlyBrand = monthlyCost(d.brand_price_rupees, d.brand_pack_count, d.doses_per_day);
        med.daysPerPack = Math.floor(d.brand_pack_count / d.doses_per_day);
      }
      if (med.monthlyBrand !== undefined && med.monthlyJa !== undefined) med.monthlySaving = Math.round((med.monthlyBrand - med.monthlyJa) * 100) / 100;
      const i = s.meds.findIndex((m) => m.id === id);
      if (i >= 0) s.meds[i] = med;
      else s.meds.push(med);
      logActivity(
        s,
        product
          ? `Found ${med.composition} on the Jan Aushadhi list (code ${product.code})` +
              (med.monthlySaving !== undefined ? `: Rs ${money(med.monthlyBrand!)} a month now, Rs ${money(med.monthlyJa!)} there` : "")
          : r.status === "near"
            ? `${med.composition}: Jan Aushadhi has it only as a different ${r.near[0].differs.includes("form") ? "form" : "release type"}`
            : `${med.composition} is not on the Jan Aushadhi list`,
      );
      result = {
        status: r.status,
        composition: med.composition,
        jan_aushadhi: product ? describe(product) : null,
        near_match: r.status === "near" ? { ...describe(r.near[0].product), differs: r.near[0].differs } : null,
        other_strengths_on_list: r.status === "other_strengths" ? r.otherStrengths.slice(0, 3).map((x) => x.name) : undefined,
        monthly_cost_now_rupees: med.monthlyBrand !== undefined ? money(med.monthlyBrand) : "unknown: no strip price yet",
        monthly_cost_jan_aushadhi_rupees: med.monthlyJa !== undefined ? money(med.monthlyJa) : null,
        monthly_saving_rupees: med.monthlySaving !== undefined ? money(med.monthlySaving) : null,
        guidance:
          r.status === "exact"
            ? "Same composition, strength, form and release type."
            : r.status === "near"
              ? "Not the same medicine unless the caller's strip actually says that form/release type; ask them to check the wording."
              : r.status === "other_strengths"
                ? "Only other strengths are listed. Never suggest a different strength; they keep their current medicine."
                : "Not on the list; they keep their current medicine.",
      };
    });
    return { content: JSON.stringify({ ...result, list_totals: totals(s) }) };
  }

  if (name === "remove_medicine") {
    const p = RemoveInput.safeParse(raw);
    if (!p.success) return bad(p.error);
    const s = await updateState(sid, (s) => {
      const before = s.meds.length;
      s.meds = s.meds.filter((m) => m.brand.toLowerCase() !== p.data.brand_name.toLowerCase());
      if (s.meds.length < before) logActivity(s, `Removed ${p.data.brand_name}`);
    });
    return { content: JSON.stringify({ medicines: s.meds.map((m) => m.brand), list_totals: totals(s) }) };
  }

  if (name === "find_nearest_store") {
    const p = StoreInput.safeParse(raw);
    if (!p.success) return bad(p.error);
    let found: Record<string, unknown> = {};
    let geo: { lat: number; lon: number; label: string } | null = null;
    const current = await updateState(sid, () => {});
    if (p.data.area_or_pincode && (!current.location || current.location.source !== "browser")) {
      geo = await geocode(p.data.area_or_pincode);
      if (!geo) return { content: JSON.stringify({ error: `couldn't find "${p.data.area_or_pincode}" on the map; ask for a nearby landmark or PIN code` }), isError: true };
    }
    await updateState(sid, (s) => {
      if (geo) s.location = { ...geo, source: "spoken" };
      if (!s.location) {
        found = { error: "location unknown: ask the caller for their area or PIN code" };
        return;
      }
      s.stores = nearest(s.location, 3);
      logActivity(s, s.stores.length ? `Nearest Jan Aushadhi store: ${s.stores[0].name}, ${s.stores[0].km} km` : "No stores found near that location");
      found = {
        near: s.location.label,
        stores: s.stores.map((k) => ({
          say_as: `the Jan Aushadhi store at ${k.address.split(",").slice(0, 2).join(",").replace(/\b\d{3,}\b/g, "").replace(/\s+/g, " ").trim()}`,
          address: k.address,
          km: k.km,
        })),
        note: "Distances are approximate (from the centre of the store's PIN code). Don't read store codes aloud.",
      };
    });
    return { content: JSON.stringify(found), isError: "error" in found };
  }

  if (name === "send_list_to_phone") {
    const p = SendInput.safeParse(raw);
    if (!p.success) return bad(p.error);
    if (!p.data.caller_confirmed) return { content: JSON.stringify({ error: "Ask the caller first; call again only after they say yes." }), isError: true };
    let out: Record<string, unknown> = {};
    await updateState(sid, (s) => {
      if (!s.meds.length) {
        out = { error: "the list is empty" };
        return;
      }
      const first = addDays(new Date(), 28);
      const reminders = s.meds.map((m) => ({ medId: m.id, brand: m.brand, date: first.toISOString().slice(0, 10) }));
      s.sent = { at: Date.now(), reminders };
      logActivity(s, `Sent the list to the phone, with a refill reminder on ${first.toDateString().slice(4)}`);
      out = { sent: true, first_refill_reminder: first.toISOString().slice(0, 10), repeats: "monthly", medicines: s.meds.length };
    });
    return { content: JSON.stringify(out), isError: "error" in out };
  }

  return { content: JSON.stringify({ error: `unknown tool ${name}` }), isError: true };
}
