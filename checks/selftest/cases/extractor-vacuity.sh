#!/bin/sh
# Purpose: selftest case — the three vacuity extractors (assertions, populations, fixtures) over the labelled detector
# fixture: every `weak vacuity` label is convicted with its rule and nothing else is (the near misses: an apostrophe
# in a message, a real template, a status equality, an absence of what was sent, guarded and literal loops). Mutations
# in a second vocabulary each convict: `?? 1`, `.catch(() => null)`, a status list holding 200 and 404, test.fixme mid-
# body, a single-quoted static wrapper, a double-quoted placeholder, a forEach, a hasText filter, a JSON provenance key
# naming the product. Arm-broken: the shared test reader broken, both test extractors fail. Env: CHECKS.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp -R "$CHECKS/selftest/fixtures/detectors" "$T/f"; cd "$T/f"
run() { for x in assertions populations fixtures; do sh "$CHECKS/extractors/vacuity.$x.sh"; done | awk '$1 == "orphan" { print $2, $3 }' | sort; }
run > got.txt; awk '$1 == "weak" && $2 == "vacuity" { print $3, $4 }' labels | sort > want.txt
cmp -s got.txt want.txt || { echo 'extractor-vacuity: the labelled fixture was misjudged' >&2; diff want.txt got.txt >&2 || true; exit 1; }
sed '$d' INVENTORY.md > i; printf '%s\n' 'ROW-911 | behavior | REQ-901 | anonymous | n/a | c | REQ-901 | tests/invariants/more.spec.ts | origin: REQ-901' '```' >> i; mv i INVENTORY.md
cat > tests/invariants/more.spec.ts <<'TS'
import { test, expect } from '@playwright/test';
test('ROW-911 second vocabularies', async ({ request, page }) => {
  const res = await request.post('/api/check', { data: { text: 'gestion' } });
  const flagged = (await res.json()).flagged;
  expect(flagged ?? 1).toBeTruthy();
  await request.post('/api/check', { data: {} }).catch(() => null);
  expect([200, 404]).toContain(res.status());
  test.fixme(flagged.length > 3, 'too many');
  await expect(page.locator("[data-element='footer']")).toBeVisible();
  expect(flagged[0].word, "the word ${flagged[0].word}").toBe('gestion');
  flagged.forEach((f) => expect(f.word).not.toBe(''));
  await expect(page.locator('mark', { hasText: 'zq-only-here' })).toHaveCount(0);
});
TS
printf '{ "Provenance": "exported from @revisor/checker", "flagged": [] }\n' > tests/invariants/fixtures/d.json
run > got.txt
for r in or-constant catch-all status-span skip-on-condition presence-static format-placeholder zero-loop substring-nothing; do
  grep -q "^tests/invariants/more.spec.ts:[0-9]* $r\$" got.txt || { echo "extractor-vacuity: $r in a second vocabulary passed" >&2; exit 1; }; done
grep -q '^tests/invariants/fixtures/d.json fixture-provenance$' got.txt || { echo 'extractor-vacuity: a circular JSON provenance passed' >&2; exit 1; }
mkdir -p "$T/x/extractors"; cp "$CHECKS/extractors/vacuity.assertions.sh" "$CHECKS/extractors/vacuity.populations.sh" "$T/x/extractors/"
sed 's/^function strip(s,/function strip(s,,/' "$CHECKS/extractors/tests.awk.txt" > "$T/x/extractors/tests.awk.txt"
for x in assertions populations; do if sh "$T/x/extractors/vacuity.$x.sh" > /dev/null 2>&1; then echo "extractor-vacuity: $x with a broken test reader exited 0" >&2; exit 1; fi; done
exit 0
