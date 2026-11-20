// Jan Aushadhi Kendras (stores) and finding the nearest ones to the caller.
import storesData from "@/data/stores.json";
import type { StoreHit } from "./store";

export interface Kendra {
  name: string;
  address: string;
  pincode?: string;
  phone?: string;
  lat: number;
  lon: number;
}

export const KENDRAS: Kendra[] = storesData as Kendra[];

export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearest(from: { lat: number; lon: number }, n = 3): StoreHit[] {
  return KENDRAS.map((k) => ({ k, d: km(from, k) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ k, d }) => ({
      name: k.name,
      address: k.address,
      pincode: k.pincode,
      phone: k.phone,
      lat: k.lat,
      lon: k.lon,
      km: Math.round(d * 10) / 10,
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lon}`,
    }));
}

// Turns a spoken area or PIN code into coordinates with OpenStreetMap's Nominatim
// (one request per lookup, within its usage policy).
export async function geocode(query: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const q = /^\d{6}$/.test(query.trim()) ? `${query.trim()}, India` : `${query}, India`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "medicine-saver/0.1 (hackathon demo; open-source)", "Accept-Language": "en" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!arr.length) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), label: arr[0].display_name.split(",").slice(0, 3).join(",") };
}
