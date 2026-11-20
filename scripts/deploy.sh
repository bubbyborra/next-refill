#!/usr/bin/env bash
# Deploys the committed code (git archive of HEAD) to Vercel production. Uncommitted files,
# keys and local folders are never uploaded. The token comes from VERCEL_TOKEN in .env.local
# and is passed to the Vercel CLI through the environment, never on the command line.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "commit your changes first (deploy uses HEAD)" >&2; exit 1; }
src=$(mktemp -d)
trap 'rm -rf "$src"' EXIT
git archive HEAD | tar -x -C "$src"
mkdir -p "$src/.vercel" && cp .vercel/project.json "$src/.vercel/"
python3 - "$src" <<'PY'
import os, re, subprocess, sys
vals = {}
for line in open(".env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")
tok = vals.get("VERCEL_TOKEN", "")
if not tok:
    sys.exit("VERCEL_TOKEN is missing from .env.local")
env = dict(os.environ, VERCEL_TOKEN=tok)
cfg = os.path.expanduser("~/.config/vercel-vivek")
try:
    r = subprocess.run(["vercel", "--global-config", cfg, "deploy", "--prod", "--yes"], cwd=sys.argv[1], env=env, text=True, capture_output=True, timeout=600)
except subprocess.TimeoutExpired:
    sys.exit("deploy timed out after 10 minutes")
out = (r.stdout + "\n" + r.stderr).replace(tok, "***")
urls = sorted(set(re.findall(r"https://[a-z0-9.-]+\.vercel\.app", out)))
print("deployed" if r.returncode == 0 else "deploy FAILED", " ".join(urls))
if r.returncode != 0:
    print(out[-1500:])
sys.exit(r.returncode)
PY
