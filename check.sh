#!/usr/bin/env bash
# The checks that prove this project works. Exits non-zero when anything fails.
# Keep it fast enough to run often, and never make a check pass by skipping, weakening or
# special-casing it.
set -euo pipefail
cd "$(dirname "$0")"

echo "== types"
npx next typegen >/dev/null
npx tsc --noEmit

echo "== matcher: 20 common medicines, expected results"
npx tsx --tsconfig tsconfig.json scripts/check_matcher.ts | tail -1

echo "== break test: traps and a sweep over the official list"
npx tsx --tsconfig tsconfig.json scripts/break_test.ts | tail -4

# Evidence labels: once evidence/EVAL_PLAN.md exists, the public text (README, submission text,
# video script) must label every evidence claim for its kind.
if [ -f evidence/EVAL_PLAN.md ] && [ -f evidence_lint.py ]; then
  python3 -I evidence_lint.py >/dev/null
fi

echo "check.sh: all checks passed"
