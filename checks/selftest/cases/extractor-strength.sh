#!/bin/sh
# Purpose: selftest case — the strength extractor reads at the function grain (v0.9.2 3.9a) over the labelled
# detector fixture: ROW-901's existence-only test convicts though ROW-902's value test sits in the same file (the
# file-grain miss), ROW-905, named by no test, is `unbound-row`, and the parameter table binds ROW-903 and ROW-904.
# Mutations: a row named only by the comment above its test, asserting `length > 0` and `toBeTruthy()` (a second
# vocabulary for existence), convicts; a row named by its describe, asserting a status, acquits. Arm-broken: the
# shared test reader broken, the extractor fails, never reports every row ok. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp -R "$CHECKS/selftest/fixtures/detectors" "$T/f"; cd "$T/f"
sh "$CHECKS/extractors/strength.playwright.sh" > out.txt
grep -q '^orphan tests/invariants/strength.spec.ts:4 existence-only ROW-901 ' out.txt || { echo 'extractor-strength: the file grain lifted ROW-901' >&2; cat out.txt >&2; exit 1; }
grep -q '^orphan tests/invariants/strength.spec.ts unbound-row ROW-905 ' out.txt || { echo 'extractor-strength: unbound ROW-905 passed' >&2; exit 1; }
[ "$(grep -c '^ok ROW-90[234]$' out.txt)" = 3 ] || { echo 'extractor-strength: the value rows or the table were not read' >&2; exit 1; }
sed '$d' INVENTORY.md > i; printf '%s\n' 'ROW-906 | behavior | REQ-900 | anonymous | n/a | a | REQ-900 | tests/invariants/more.spec.ts | origin: REQ-900' 'ROW-907 | behavior | REQ-900 | anonymous | n/a | b | REQ-900 | tests/invariants/more.spec.ts | origin: REQ-900' '```' >> i; mv i INVENTORY.md
cat > tests/invariants/more.spec.ts <<'TS'
import { test, expect } from '@playwright/test';
// ROW-906: the list is there
test('the list is there', async ({ request }) => {
  const list = (await (await request.post('/api/check', { data: { text: 'x' } })).json()).flagged;
  expect(list.length).toBeGreaterThan(0);
  expect(list[0]).toBeTruthy();
});
test.describe('ROW-907 the endpoint refuses', () => {
  test('a malformed body', async ({ request }) => { expect((await request.post('/api/check', { data: {} })).status()).toBe(400); });
});
TS
sh "$CHECKS/extractors/strength.playwright.sh" > out.txt
grep -q '^orphan tests/invariants/more.spec.ts:3 existence-only ROW-906 ' out.txt || { echo 'extractor-strength: existence in a second vocabulary passed' >&2; cat out.txt >&2; exit 1; }
grep -q '^ok ROW-907$' out.txt || { echo 'extractor-strength: a describe-named status row was not bound' >&2; exit 1; }
mkdir -p "$T/x/extractors"; cp "$CHECKS/inventory.sh" "$CHECKS/prd.sh" "$T/x/"; cp "$CHECKS/extractors/strength.playwright.sh" "$T/x/extractors/"
sed 's/^function strip(s,/function strip(s,,/' "$CHECKS/extractors/tests.awk.txt" > "$T/x/extractors/tests.awk.txt"
if sh "$T/x/extractors/strength.playwright.sh" > /dev/null 2>&1; then echo 'extractor-strength: a broken test reader exited 0' >&2; exit 1; fi
exit 0
