#!/bin/sh
# Purpose: census extractor — vacuity (report-only), the circular fixture: every data file under tests/invariants/
# (anything but .ts/.js/.mjs/.cjs/.md source) carries a `Provenance:` line (or a "provenance" key, for JSON) in its
# first 5 lines saying where its content came from, and that provenance does not name the product itself (src/,
# @revisor/, "the product") — a fixture made by the code it tests can only agree with it.
set -eu
[ -d tests/invariants ] || { echo "inactive no tests/invariants/ here"; exit 0; }
L=$(find tests/invariants -type f ! -name '*.ts' ! -name '*.js' ! -name '*.mjs' ! -name '*.cjs' ! -name '*.md' 2>/dev/null | sort)
[ -n "$L" ] || { echo "inactive no fixture file under tests/invariants/"; exit 0; }
printf '%s\n' "$L" | while IFS= read -r f; do
  h=$(awk 'NR > 5 { exit } tolower($0) ~ /provenance:|"provenance"[ \t]*:/ { print; exit }' "$f")
  if [ -z "$h" ]; then echo "orphan $f fixture-provenance no Provenance: line in its first 5 lines — where its content came from is unstated"
  elif printf '%s\n' "$h" | awk 'tolower($0) ~ /src\/|@revisor\/|the product/ { f = 1 } END { exit !f }'; then echo "orphan $f fixture-provenance its provenance names the product itself — circular"
  else echo "ok $f"; fi
done
