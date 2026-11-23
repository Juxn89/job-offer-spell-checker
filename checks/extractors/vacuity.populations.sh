#!/bin/sh
# Purpose: census extractor — vacuity (report-only), the population shapes, in each row-bound Playwright test
# (tests.awk.txt): substring-nothing (a literal handed to .not.toContain, .includes or hasText that appears nowhere
# else in the test — an absence of what was never planted), zero-loop (a for…of or forEach holding an assertion over
# a collection the test never checks is non-empty; an inline array or a file-level non-empty array literal is fine).
set -eu
X=$(cd "$(dirname "$0")" && pwd)
[ -f INVENTORY.md ] || { echo "inactive no INVENTORY.md here"; exit 0; }
RT=$(awk -F' [|] ' '$1 ~ /^ROW-[0-9]+$/ && $8 ~ /^tests\// { split($8, a, " "); print $1 " " a[1] }' INVENTORY.md)
EX=$(printf '%s\n' "$RT" | awk 'NF { print $2 }' | sort -u | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done || true)
[ -n "$EX" ] || { echo "inactive no row cites a test file that exists yet"; exit 0; }
ST=$(cat $EX | sed -nE 's/^[[:space:]]*(export[[:space:]]+)?(const|let|var)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)[^=]*=[[:space:]]*\[[[:space:]]*([^][:space:]].*)?$/\3/p' | tr '\n' ' ')
P=$(mktemp); B=$(mktemp); trap 'rm -f "$P" "$B"' EXIT
cat > "$P" <<'AWK'
BEGIN { FS = "\t"; n = split(rt, a, ";"); for (i = 1; i <= n; i++) if (a[i] != "") { split(a[i], b, " "); CF[b[1]] = CF[b[1]] " " b[2] " " } }
function bound(rs, f,   n, a, i) { n = split(rs, a, " "); for (i = 1; i <= n; i++) if (index(CF[a[i]], " " f " ")) return a[i]; return "" }
function cnt(s, x,   c, i) { c = 0; while ((i = index(s, x)) > 0) { c++; s = substr(s, i + length(x)) } return c }
$1 == "B" { F = $2; rb = bound($4, $2); n = 0; if (rb != "") nb++; next }
$1 == "L" { if (rb == "") next; t = $0; sub(/^[^\t]*\t[^\t]*\t[^\t]*\t/, "", t); T[++n] = t; N[n] = $3; next }
$1 == "E" && rb != "" { all = ""; for (i = 1; i <= n; i++) all = all "\n" T[i]
  for (i = 1; i <= n; i++) { t = T[i]; if (t ~ /^[ \t]*(\/\/|\/?\*)/) continue
    if (match(t, /(\.not\.toContain|\.includes|hasText:)[ \t]*\(?[ \t]*('[^']+'|"[^"]+")/)) { l = substr(t, RSTART, RLENGTH); sub(/^[^'"]*['"]/, "", l); l = substr(l, 1, length(l) - 1)
      if (!index(l, "${") && cnt(all, l) == 1) print "orphan " F ":" N[i] " substring-nothing " rb " — '" l "' appears nowhere else in the test: its absence proves nothing" }
    y = ""; if (match(t, /for[ \t]*\([ \t]*(const|let|var)[ \t]+(\[[^]]*\]|\{[^}]*\}|[A-Za-z_$][A-Za-z0-9_$]*)[ \t]+of[ \t]+/)) { y = substr(t, RSTART + RLENGTH); sub(/\).*/, "", y) }
    else if (match(t, /[A-Za-z_$][A-Za-z0-9_$.]*[ \t]*\.forEach[ \t]*\(/)) { y = substr(t, RSTART, RLENGTH); sub(/[ \t]*\.forEach.*/, "", y) }
    sub(/^await[ \t]+/, "", y); if (y == "" || y ~ /^\[/) continue
    nm = y; if (match(nm, /^[A-Za-z_$][A-Za-z0-9_$.]*/)) nm = substr(nm, 1, RLENGTH); if (index(" " st " ", " " nm " ")) continue
    e = 0; for (j = i; j <= n; j++) if (T[j] ~ /expect|\.to[A-Z]/) e = 1; if (!e) continue
    g = 0; for (j = 1; j <= n; j++) if (j != i && index(T[j], nm) && T[j] ~ /\.length[ \t]*\)[ \t]*\.(toBeGreaterThan|toBeGreaterThanOrEqual|toBe|toEqual)[ \t]*\([ \t]*[1-9]|\.length[ \t]*\)[ \t]*\.toBeGreaterThan[ \t]*\([ \t]*0|toHave(Length|Count)[ \t]*\([ \t]*[1-9]|\.not\.toHave(Length|Count)[ \t]*\([ \t]*0|\.toEqual[ \t]*\([ \t]*\[[ \t]*[^] \t]/) g = 1
    if (!g) print "orphan " F ":" N[i] " zero-loop " rb " — loops over " nm " with no check that it holds an item: zero items assert nothing" } }
END { if (nb) print "population " nb; else print "inactive no test names a row that cites its file" }
AWK
awk -f "$X/tests.awk.txt" $EX > "$B"   # its own step: a reader that fails stops here, never an empty input
awk -v rt="$(printf '%s\n' "$RT" | tr '\n' ';')" -v st="$ST" -f "$P" "$B"
