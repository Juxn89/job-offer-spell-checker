#!/bin/sh
# Purpose: results reader — the per-case report Playwright's JUnit reporter writes through the harness's
# PLAYWRIGHT_JUNIT_OUTPUT_NAME, normalised to `case <path>::<name> <passed|failed|skipped|error> <seconds>`:
# <path> the test file under the runner's testDir, <name> `[<project>]` and the case's title path with
# whitespace made `_`; <failure> (an expect that failed, or the case limit) is failed, <error> (a throw outside
# an assertion: setup, a hook, a crash) is error. Comments, CDATA and captured output are text, never cases.
set -eu
R=${1:-}
[ -n "$R" ] && [ -s "$R" ] || { echo "inactive no report${R:+ at $R}"; exit 0; }
grep -q '<testsuites' "$R" || { echo "inactive $R is not a JUnit report"; exit 0; }
grep -q '</testsuites>' "$R" || { echo "inactive $R is cut short: no closing testsuites"; exit 0; }
TD=$(sed -n "s/.*testDir:[[:space:]]*['\"]\([^'\"]*\)['\"].*/\1/p" playwright.config.ts 2>/dev/null | head -n 1)
P=$(mktemp); trap 'rm -f "$P"' EXIT
cat > "$P" <<'AWK'
function cut(s, a, b,   i, j) { while ((i = index(s, a)) > 0) { j = index(substr(s, i), b); s = substr(s, 1, i - 1) (j ? substr(s, i + j + length(b) - 1) : "") } return s }
function at(t, k) { if (!match(t, "[ \t\n]" k "=\"[^\"]*\"")) return ""; t = substr(t, RSTART, RLENGTH); sub(/^[^"]*"/, "", t); sub(/"$/, "", t)
  gsub(/&quot;/, "\"", t); gsub(/&apos;/, "'", t); gsub(/&lt;/, "<", t); gsub(/&gt;/, ">", t); gsub(/&amp;/, "\\&", t); return t }
function out() { gsub(/[ \t\r\n]+/, "_", nm); printf "case %s/%s::[%s]%s %s %s\n", td, cls, proj, nm, st, (sec == "" ? 0 : sec); inc = 0 }
BEGIN { RS = "\001" }
{ s = cut($0, "<!--", "-->"); s = cut(s, "<![CDATA[", "]]>"); s = cut(s, "<system-out", "</system-out>"); s = cut(s, "<system-err", "</system-err>")
  n = split(s, tag, "<")
  for (i = 2; i <= n; i++) { t = tag[i]
    if (t ~ /^testsuite[ \t\n>]/) proj = at(t, "hostname")
    else if (t ~ /^testcase[ \t\n\/>]/) { nm = at(t, "name"); cls = at(t, "classname"); sec = at(t, "time"); st = "passed"; inc = 1
      if (t ~ /\/[ \t\n]*>/) out() }
    else if (inc && t ~ /^failure[ \t\n\/>]/) st = "failed"
    else if (inc && t ~ /^error[ \t\n\/>]/ && st != "failed") st = "error"
    else if (inc && t ~ /^skipped[ \t\n\/>]/ && st == "passed") st = "skipped"
    else if (inc && t ~ /^\/testcase[ \t\n>]/) out() } }
AWK
awk -v td="${TD:-tests/invariants}" -f "$P" "$R"
