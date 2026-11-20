"""Build src/data/stores.json from the official Jan Aushadhi Kendra list.

Input: data/source/kendras-bengaluru-urban.tsv (janaushadhi.gov.in > Locate Kendra, Karnataka / Bengaluru Urban).
Coordinates: the centre of each store's PIN code, from OpenStreetMap Nominatim (one request per PIN code,
1 per second, cached in data/source/pin-geocode.json). Distances are therefore approximate (PIN-code level).
"""
import json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "kendras-bengaluru-urban.tsv"
CACHE = ROOT / "data" / "source" / "pin-geocode.json"
OUT = ROOT / "src" / "data" / "stores.json"
UA = "medicine-saver/0.1 (hackathon demo; open-source)"

rows = []
for line in SRC.read_text().splitlines():
    if line.startswith("#") or line.startswith("kendra_code"):
        continue
    code, pin, addr = line.split("\t", 2)
    rows.append((code, pin, addr))

cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
for pin in sorted({p for _, p, _ in rows}):
    if pin in cache:
        continue
    q = urllib.parse.urlencode({"postalcode": pin, "country": "India", "format": "jsonv2", "limit": 1})
    req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{q}", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            res = json.load(r)
        cache[pin] = [float(res[0]["lat"]), float(res[0]["lon"])] if res else None
    except Exception as e:
        print("geocode failed", pin, e)
        cache[pin] = None
    CACHE.write_text(json.dumps(cache, indent=0))
    time.sleep(1.1)

stores, missing = [], 0
for code, pin, addr in rows:
    ll = cache.get(pin)
    # keep only points inside greater Bengaluru, to drop a wrong match on another city
    if not ll or not (12.6 < ll[0] < 13.4 and 77.3 < ll[1] < 77.95):
        missing += 1
        continue
    stores.append({"name": f"Jan Aushadhi Kendra {code}", "address": f"{addr}, Bengaluru {pin}", "pincode": pin, "lat": ll[0], "lon": ll[1]})
OUT.write_text(json.dumps(stores, ensure_ascii=False, indent=0))
print(f"{len(stores)} stores written, {missing} without coordinates, {len(cache)} PIN codes cached")
