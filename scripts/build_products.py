"""Build src/data/products.json from an official Jan Aushadhi (PMBJP) product list.

Sources, in order of preference:
  1. PMBI "Product & MRP List" (janaushadhi.gov.in > Product Portfolio > Product & MRP List), read from the
     page's table into data/source/pmbi-product-mrp-list.tsv. Gives drug code, generic name, unit size, MRP and group.
  2. PIB annexure "The list of 2110 generic medicines under PMBJP till 31.12.2025"
     (static.pib.gov.in), saved as data/source/pib-pmbjp-2110-medicines-2025-12-31.pdf.
     Gives drug code, generic name and unit size, but no MRP.

Usage: python3 scripts/build_products.py data/source/pmbi-product-mrp-list.tsv
Needs `pdftotext` (poppler) for PDF input.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "products.json"

ROW = re.compile(r"^\s*(\d+)\s+(\d+)\s+(.+?)\s{2,}(\d+\s*'s|\d+(?:\.\d+)?\s*(?:ml|g|gm|kg|mg|L|l|units?|pcs?|nos?\.?|kit|pair|set|tube|bottle|vial|amp|strip)s?\b.*)$", re.I)

def pdf_text(p: Path) -> str:
    return subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True, check=True).stdout

def parse_pib(text: str):
    items, cur = [], None
    for line in text.splitlines():
        m = ROW.match(line)
        if m:
            cur = {"code": m.group(2), "name": m.group(3).strip(), "unit": m.group(4).strip(), "mrp": None, "group": ""}
            items.append(cur)
            continue
        # wrapped name lines are indented text with no leading serial number
        if cur and line.strip() and re.match(r"^\s{8,}\S", line) and not re.match(r"^\s*(S\. No\.|Code|Drug)", line.strip()):
            frag = line.strip()
            if not re.match(r"^\d+\s", frag):
                cur["name"] = (cur["name"] + " " + frag).strip()
        elif not line.strip():
            cur = cur  # blank lines keep the current row open for one more wrapped line
    return items

def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "source" / "pib-pmbjp-2110-medicines-2025-12-31.pdf"
    if src.suffix.lower() == ".pdf":
        items = parse_pib(pdf_text(src))
    elif src.suffix.lower() == ".tsv":
        items = []
        for line in src.read_text().splitlines():
            if line.startswith("#") or line.startswith("drug_code"):
                continue
            code, name, unit, mrp, group = line.split("\t")
            try:
                price = float(mrp)
            except ValueError:
                price = 0.0
            items.append({"code": code, "name": name, "unit": unit, "mrp": price if price > 0 else None, "group": group})
    else:
        raise SystemExit(f"unsupported input: {src}")
    seen, out = set(), []
    for it in items:
        if it["code"] in seen:
            continue
        seen.add(it["code"])
        it["name"] = re.sub(r"\s+", " ", it["name"]).strip()
        out.append(it)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    priced = sum(1 for x in out if x["mrp"])
    print(f"{len(out)} products ({priced} with MRP) from {src.name} -> {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
