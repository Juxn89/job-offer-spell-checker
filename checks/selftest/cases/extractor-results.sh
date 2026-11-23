#!/bin/sh
# Purpose: selftest case — the results reader (checks/extractors/results.sh, the receipt courts' only view of a run)
# turns a Playwright JUnit report with one case of each status into four `case` lines with the right statuses; a
# failure and an error in one case read failed; a self-closing testcase reads passed; a failure written inside a
# passing case's captured output (CDATA) or a comment is text, never a status or a case; entities in a title decode.
# A report cut short, or none, reads `inactive`, never zero cases. Fixture-only. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; printf "export default { testDir: 'tests/invariants' };\n" > playwright.config.ts
cat > r.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="6"><!-- <testcase name="ghost" classname="x.spec.ts"><failure/></testcase> -->
<testsuite name="a.spec.ts" hostname="chromium" tests="6">
<testcase name="ROW-1 passes &amp; &quot;quotes&quot;" classname="a.spec.ts" time="0.5"><system-out><![CDATA[<failure message="not mine"/>]]></system-out></testcase>
<testcase name="ROW-2 fails" classname="a.spec.ts" time="1.25"><failure message="expected 1">x</failure></testcase>
<testcase
  classname="a.spec.ts" name="ROW-3 errors" time="2"><error message="boom"/></testcase>
<testcase name="ROW-4 skipped" classname="a.spec.ts"><skipped/></testcase>
<testcase name="ROW-5 both" classname="a.spec.ts" time="3"><error message="hook"/><failure message="then this"/></testcase>
<testcase name="ROW-6 self-closing" classname="a.spec.ts" time="0.1"/>
</testsuite></testsuites>
EOF
sh "$CHECKS/extractors/results.sh" r.xml > out.txt
cat > want.txt <<'EOF'
case tests/invariants/a.spec.ts::[chromium]ROW-1_passes_&_"quotes" passed 0.5
case tests/invariants/a.spec.ts::[chromium]ROW-2_fails failed 1.25
case tests/invariants/a.spec.ts::[chromium]ROW-3_errors error 2
case tests/invariants/a.spec.ts::[chromium]ROW-4_skipped skipped 0
case tests/invariants/a.spec.ts::[chromium]ROW-5_both failed 3
case tests/invariants/a.spec.ts::[chromium]ROW-6_self-closing passed 0.1
EOF
cmp -s out.txt want.txt || { echo 'extractor-results: the statuses were misread' >&2; diff want.txt out.txt >&2 || true; exit 1; }
head -c 400 r.xml > cut.xml; sh "$CHECKS/extractors/results.sh" cut.xml | grep -q '^inactive ' || { echo 'extractor-results: a report cut short was read' >&2; exit 1; }
sh "$CHECKS/extractors/results.sh" missing.xml | grep -q '^inactive ' || { echo 'extractor-results: a missing report was not inactive' >&2; exit 1; }
exit 0
