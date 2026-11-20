// Per-call state shared by the model route, the tools, the call screen and the phone page.
// Uses Upstash Redis (REST) when its env vars are set, so every serverless instance sees the
// same call; otherwise an in-memory map, which is fine for one local server.
import type { Form, QueryIngredient, Release } from "./products";
import type { LangCode } from "./languages";

export interface Med {
  id: string;
  brand: string;
  forWhom?: string;
  ingredients: QueryIngredient[];
  composition: string; // e.g. "Telmisartan 40 mg"
  form: Form;
  release: Release;
  dosesPerDay: number;
  brandPrice?: number; // rupees per pack, as the caller said or the strip shows
  brandPack?: number; // units per pack
  ja?: {
    code: string;
    name: string;
    unit: string;
    mrp: number | null;
    packCount: number | null;
  };
  status: "matched" | "no_match" | "check";
  note?: string;
  monthlyBrand?: number;
  monthlyJa?: number;
  monthlySaving?: number;
  daysPerPack?: number;
}

export interface StoreHit {
  name: string;
  address: string;
  pincode?: string;
  phone?: string;
  lat: number;
  lon: number;
  km: number;
  mapsUrl: string;
}

export interface Activity {
  t: number;
  text: string;
}

export interface CallState {
  sid: string;
  lang: LangCode;
  createdAt: number;
  channel: string;
  userUid: number;
  agentUid: number;
  agentId?: string;
  meds: Med[];
  location?: { lat: number; lon: number; label: string; source: "browser" | "spoken" };
  stores?: StoreHit[];
  sent?: { at: number; reminders: { medId: string; brand: string; date: string }[] };
  strip?: { at: number; summary: string };
  voiceNote?: { key: string; text: string };
  typed?: { user: string; agent: string }[];
  activity: Activity[];
  ended?: boolean;
}

const TTL_SECONDS = 60 * 60 * 24 * 3;

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

type Mem = Map<string, string>;
const g = globalThis as unknown as { __callStore?: Mem };
const mem: Mem = g.__callStore ?? (g.__callStore = new Map());

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`state store error ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`state store error: ${data.error}`);
  return data.result;
}

const key = (sid: string) => `call:${sid}`;

export async function getState(sid: string): Promise<CallState | null> {
  if (!/^[a-z0-9]{6,32}$/.test(sid)) return null;
  const raw = redisUrl && redisToken ? ((await redis(["GET", key(sid)])) as string | null) : mem.get(key(sid)) ?? null;
  return raw ? (JSON.parse(raw) as CallState) : null;
}

export async function putState(state: CallState): Promise<void> {
  const raw = JSON.stringify(state);
  if (redisUrl && redisToken) await redis(["SET", key(state.sid), raw, "EX", TTL_SECONDS]);
  else mem.set(key(state.sid), raw);
}

export async function updateState(sid: string, fn: (s: CallState) => void | Promise<void>): Promise<CallState> {
  const s = await getState(sid);
  if (!s) throw new Error("call not found");
  await fn(s);
  await putState(s);
  return s;
}

export function logActivity(s: CallState, text: string) {
  s.activity.push({ t: Date.now(), text });
  if (s.activity.length > 40) s.activity.splice(0, s.activity.length - 40);
}

export function storeKind(): "redis" | "memory" {
  return redisUrl && redisToken ? "redis" : "memory";
}
