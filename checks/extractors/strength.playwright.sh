#!/bin/sh
# Purpose: census extractor — strength (report-only, v0.8.1d): each row-bound Playwright test's assertions on the
# ladder Existence 1 → Type 2 → Status 3 → Value 4, read at the function grain (tests.awk.txt: the test whose title,
# describe, comment or parameter table names the row). A protected row (checks/inventory.sh protected) whose
# strongest assertion is existence — present, absent, empty or a count above zero, no expected value — is an orphan;
# so is one whose cited file holds no test naming it (unbound-row). A call to an expect…/assert… helper counts as Value.
set -eu
X=$(cd "$(dirname "$0")" && pwd)
[ -f INVENTORY.md ] || { echo "inactive no INVENTORY.md here"; exit 0; }
RT=$(awk -F' [|] ' '$1 ~ /^ROW-[0-9]+$/ && $8 ~ /^tests\// { split($8, a, " "); print $1 " " a[1] }' INVENTORY.md)
[ -n "$RT" ] || { echo "inactive no row cites a test yet"; exit 0; }
PO=$(sh "$X/../inventory.sh" protected) || { echo "strength: checks/inventory.sh protected failed" >&2; exit 1; }
PR=$(printf '%s\n' "$PO" | awk '$1 == "protected" && $2 ~ /^ROW-/ { printf " %s", $2 }')
EX=$(printf '%s\n' "$RT" | awk '{ print $2 }' | sort -u | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done || true)
P=$(mktemp); B=$(mktemp); trap 'rm -f "$P" "$B"' EXIT
cat > "$P" <<'AWK'
BEGIN { FS = "\t"; n = split(rt, a, ";"); for (i = 1; i <= n; i++) { if (a[i] == "") continue; split(a[i], b, " "); RF[b[1]] = b[2]; R[++nr] = b[1] } }
function lvl(t,   s, r, b, v, st) { if (t ~ /^[ \t]*(\/\/|\/?\*)/) return 0
  b = (t ~ /(^|[^.A-Za-z0-9_$])(expect|assert)[A-Z][A-Za-z0-9_]*[ \t]*\(/) ? 4 : 0
  st = (t ~ /\.status\(\)|\.ok\(\)/) ? 3 : (t ~ /typeof/ ? 2 : 4); s = t
  while (match(s, /\.to[A-Z][A-Za-z]*[ \t]*\(/)) { r = substr(s, RSTART); s = substr(s, RSTART + RLENGTH)
    if (r ~ /^\.toPass/) v = 0; else if (r ~ /^\.toBeOK/) v = 3; else if (r ~ /^\.toBeInstanceOf/) v = 2
    else if (r ~ /^\.to(BeVisible|BeAttached|BeHidden|BeDefined|BeUndefined|BeTruthy|BeFalsy|BeNull|BeEmpty|BeNaN)[ \t]*\(/ || r ~ /^\.to(HaveCount|HaveLength)[ \t]*\([ \t]*0[ \t]*[,)]/ || r ~ /^\.toBeGreaterThan[ \t]*\([ \t]*0[ \t]*\)/ || r ~ /^\.toBeGreaterThanOrEqual[ \t]*\([ \t]*1[ \t]*\)/) v = (st == 3 ? 3 : 1)
    else v = st
    if (v > b) b = v }
  return b }
$1 == "B" { f = $2; ln = $3; br = $4; best = 0; next }
$1 == "L" { t = $0; sub(/^[^\t]*\t[^\t]*\t[^\t]*\t/, "", t); v = lvl(t); if (v > best) best = v; next }
$1 == "E" { n = split(br, a, " "); for (i = 1; i <= n; i++) { r = a[i]; if (RF[r] != f) continue; if (!(r in LV) || best > LV[r]) { LV[r] = best; LL[r] = ln } } }
END { for (i = 1; i <= nr; i++) { r = R[i]; f = RF[r]
    if (index(pr " ", " " r " ") == 0) print "ok " r
    else if (!(r in LV)) print "orphan " f " unbound-row " r " — its cited file holds no test naming it"
    else if (LV[r] <= 1) print "orphan " f ":" LL[r] " existence-only " r " strongest=" (LV[r] ? "existence" : "none")
    else print "ok " r } }
AWK
[ -z "$EX" ] || awk -f "$X/tests.awk.txt" $EX > "$B"   # its own step: a reader that fails stops here, never an empty input
awk -v rt="$(printf '%s\n' "$RT" | tr '\n' ';')" -v pr="$PR" -f "$P" "$B"
