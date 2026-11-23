#!/bin/sh
# Purpose: census extractor — vacuity (report-only), the assertion-line shapes, in each row-bound Playwright test
# (tests.awk.txt): or-constant, literal-vs-literal, catch-all (a bare toThrow(), an empty catch, a swallowing .catch),
# status-span (a range on status(), or a status list holding success and error), skip-on-condition (test.skip or
# test.fixme in the body, an early return), presence-static (a presence check on a wrapper that renders even empty),
# format-placeholder (a '…' or "…" literal holding ${, read to its own closing quote; backtick templates are fine).
set -eu
X=$(cd "$(dirname "$0")" && pwd)
[ -f INVENTORY.md ] || { echo "inactive no INVENTORY.md here"; exit 0; }
RT=$(awk -F' [|] ' '$1 ~ /^ROW-[0-9]+$/ && $8 ~ /^tests\// { split($8, a, " "); print $1 " " a[1] }' INVENTORY.md)
EX=$(printf '%s\n' "$RT" | awk 'NF { print $2 }' | sort -u | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done || true)
[ -n "$EX" ] || { echo "inactive no row cites a test file that exists yet"; exit 0; }
P=$(mktemp); B=$(mktemp); trap 'rm -f "$P" "$B"' EXIT
cat > "$P" <<'AWK'
BEGIN { FS = "\t"; n = split(rt, a, ";"); for (i = 1; i <= n; i++) if (a[i] != "") { split(a[i], b, " "); CF[b[1]] = CF[b[1]] " " b[2] " " } }
function bound(rs, f,   n, a, i) { n = split(rs, a, " "); for (i = 1; i <= n; i++) if (index(CF[a[i]], " " f " ")) return a[i]; return "" }
function o(rule, why) { print "orphan " F ":" $3 " " rule " " rb " — " why; hit = 1 }
function fmt(s,   i, c, q, b, n) { n = length(s); q = ""
  for (i = 1; i <= n; i++) { c = substr(s, i, 1)
    if (q != "") { if (c == "\\") { i++; continue } if (c == q) { if (q != "`" && index(b, "${")) return b; q = ""; continue } b = b c; continue }
    if (c == "/" && substr(s, i + 1, 1) == "/") return ""
    if (c == "'" || c == "\"" || c == "`") { q = c; b = "" } }
  return "" }
$1 == "B" { F = $2; bs = $3; rb = bound($4, $2); if (rb != "") nb++; next }
$1 == "E" { rb = ""; next }
$1 == "L" && rb != "" { t = $0; sub(/^[^\t]*\t[^\t]*\t[^\t]*\t/, "", t); if (t ~ /^[ \t]*(\/\/|\/?\*)/) next; hit = 0
  if (t ~ /expect/ && t ~ /(\|\||\?\?)[ \t]*(true|1|!0)([^A-Za-z0-9_]|$)/) o("or-constant", "the assertion is or-ed with a constant")
  if (!hit && t ~ /(^|[^A-Za-z0-9_.])expect[ \t]*\([ \t]*(true|false|null|undefined|-?[0-9]+(\.[0-9]+)?|'[^']*'|"[^"]*")[ \t]*[,)]/) o("literal-vs-literal", "expect() of a literal compares nothing the action produced")
  if (!hit && (t ~ /\.toThrow[ \t]*\([ \t]*\)/ || t ~ /catch[ \t]*(\([^)]*\))?[ \t]*\{[ \t]*\}/ || t ~ /\.catch[ \t]*\([ \t]*(\([^)]*\)|[A-Za-z_$]+)[ \t]*=>[ \t]*(\{[ \t]*\}|null|undefined|false|0)[ \t]*\)/)) o("catch-all", "any error passes, or the error is swallowed")
  if (!hit && (t ~ /\.status\(\)[ \t]*\)[ \t]*\.(not\.)?to(BeLessThan|BeGreaterThan|BeLessThanOrEqual|BeGreaterThanOrEqual)[ \t]*\(/ || (t ~ /\[[ \t]*[0-9][0-9][0-9]([ \t]*,[ \t]*[0-9][0-9][0-9])+[ \t]*\][ \t]*\)[ \t]*\.toContain[ \t]*\(/ && t ~ /[[ ,]2[0-9][0-9]/ && t ~ /[[ ,][45][0-9][0-9]/))) o("status-span", "the status assertion accepts a span of codes")
  if (!hit && (($3 != bs && t ~ /(^|[^A-Za-z0-9_.$])test\.(skip|fixme)[ \t]*\(/) || t ~ /(^|[^A-Za-z0-9_])if[ \t]*\(.*\)[ \t]*\{?[ \t]*return[ \t]*;?[ \t]*\}?[ \t]*;?[ \t]*$/)) o("skip-on-condition", "the test can end before it asserts")
  if (!hit && (t ~ /\.(toBeVisible|toBeAttached)[ \t]*\(|\.toHaveCount[ \t]*\([ \t]*1[ \t]*\)/) && (t ~ /data-element=\\?["'](checker|offer|check|footer|notice|privacy-link|privacy-note|back)\\?["']/ || t ~ /locator[ \t]*\([ \t]*['"](body|main|html)['"][ \t]*\)/)) o("presence-static", "a presence check on a wrapper that renders even when empty")
  if (!hit && t ~ /expect|\.to[A-Z]/ && fmt(t) != "") o("format-placeholder", "a quoted literal holding ${ is no template: the placeholder is never filled") }
END { if (nb) print "population " nb; else print "inactive no test names a row that cites its file" }
AWK
awk -f "$X/tests.awk.txt" $EX > "$B"   # its own step: a reader that fails stops here, never an empty input
awk -v rt="$(printf '%s\n' "$RT" | tr '\n' ';')" -f "$P" "$B"
