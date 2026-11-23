// Purpose: ledger test for ROW-069 (REQ-032) — after checks from a known address, that address is in no
// file on the server (nor in the product's log), and it stops counting toward the check limit one minute
// after its last check.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from REQ-032 (A-028) and the limit's numbers from REQ-022, never from the product's source.
//
// Test argument
// ROW-069 promise: REQ-032 (A-028) — "an IP address is held in memory only, for the 1-minute window of
// ROW-069   the check limit"; fail-if "an IP address is found in any file, database or cache on the server
// ROW-069   … or an address still counts toward the limit more than a minute after its last check";
// ROW-069   REQ-022 sets the limit the address counts toward: 30 checks a minute, the 31st refused.
// ROW-069 wrong product: the limiter keeps its counters in a file or an on-disk cache so they survive a
// ROW-069   restart; or it writes "refused 172.18.0.5" to a log or a block-list file; or it uses a fixed
// ROW-069   10-minute (or hourly) window, or blocks an address that hit the limit for five minutes, so the
// ROW-069   address still counts long after its last check.
// ROW-069 given: the tests container's own IPv4 address — the one every harness request arrives from
// ROW-069   (D-025: no proxy in the harness); the whole check budget held (D-030) so no other test's check
// ROW-069   shares the minute; a fresh offer with one known misspelling (the dictionary oracle).
// ROW-069 when: 30 checks are sent at once from that address (the first carrying the misspelling), then
// ROW-069   a 31st; then, while the address is counted, the product's files and log are searched for it;
// ROW-069   then the test waits until 62 s after the 31st check and sends one more.
// ROW-069 then: the 31st is refused (the address counts — the control that the limit sees this address);
// ROW-069   no file in the product's container holds the address and no line of its log does; the check
// ROW-069   sent 62 s after the last one is accepted (the address no longer counts); and the files and the
// ROW-069   log still hold no copy of the address.
// ROW-069 controls: the control case shows a check from this address is answered and flags the known
// ROW-069   misspelling (the path that touches the limiter is reached); inside the target, the 31st refusal
// ROW-069   is the before that makes the 62-second acceptance the after.
// ROW-069 technique: the limit's own boundary (31st refused within the minute; accepted just past a
// ROW-069   minute: 62 s, two seconds over for transit and clocks) and a whole-filesystem search through the
// ROW-069   operator door (D-024) for the address as a whole token.
// ROW-069 cases: ROW-069 target=tests/invariants/test-req032-row069-address-forgotten.api.spec.ts::[api]ROW-069_the_address_is_in_no_file_and_stops_counting_one_minute_after_its_last_check control=tests/invariants/test-req032-row069-address-forgotten.api.spec.ts::[api]ROW-069_control:_a_check_from_this_address_is_answered_and_flags_the_known_misspelling

import { expect, test } from '@playwright/test';
import { checkText, CHECKS_PER_MINUTE, freshRandom, holdCheckBudget, productLogs, searchProductFiles, sendRaw } from './harness';
import { misspelledOffer, ownIPv4Addresses, wholeAddress } from './privacy-page-helpers';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

async function expectAddressNowhere(addresses: string[], stage: string): Promise<void> {
  const log = await productLogs();
  for (const ip of addresses) {
    const lines = log.split('\n').filter((l) => wholeAddress(ip).test(l));
    expect(lines, `ROW-069 (${stage}): no line of the product's log holds the address ${ip}`).toEqual([]);
    const found = await searchProductFiles(ip);
    // The search matches the address's bytes; a file holding a longer number that begins with them
    // (172.18.0.30 for 172.18.0.3) would match too — the path is printed so such a hit can be told apart.
    expect(found.matches, `ROW-069 (${stage}): no file on the server holds the address ${ip}`).toEqual([]);
  }
}

test('ROW-069 control: a check from this address is answered and flags the known misspelling', async () => {
  const offer = misspelledOffer(freshRandom());
  const answer = await checkText(offer.text);
  expect(
    answer.flagged.map((f) => ({ start: f.start, end: f.end, word: f.word })),
    'ROW-069 control: the check flags exactly the known misspelling, at its place',
  ).toEqual([{ start: offer.start, end: offer.start + offer.misspelled.length, word: offer.misspelled }]);
});

test('ROW-069 the address is in no file and stops counting one minute after its last check', async () => {
  test.setTimeout(480_000);
  const addresses = ownIPv4Addresses();
  const offer = misspelledOffer(freshRandom());
  const hold = await holdCheckBudget();
  try {
    // 30 checks from this address: all accepted, the first carrying the misspelling.
    const statuses: number[] = [];
    let flaggedFirst: string[] = [];
    for (let i = 0; i < CHECKS_PER_MINUTE; i++) {
      const res = await sendRaw({ body: { text: offer.text }, pace: false });
      statuses.push(res.status);
      if (i === 0 && res.status === 200) flaggedFirst = (JSON.parse(res.body) as { flagged: { word: string }[] }).flagged.map((f) => f.word);
    }
    expect(statuses, 'ROW-069: the first 30 checks within the minute are all accepted').toEqual(Array(CHECKS_PER_MINUTE).fill(200));
    expect(flaggedFirst, 'ROW-069: the first check flags its known misspelling').toEqual([offer.misspelled]);

    // The 31st: refused — the address counts toward the limit now.
    const thirtyFirst = await sendRaw({ body: { text: offer.text }, pace: false });
    const lastCheckAt = Date.now();
    expect(thirtyFirst.status, 'ROW-069: the 31st check within the minute is refused (this address counts)').not.toBe(200);
    expect(thirtyFirst.status, 'ROW-069: the refusal is a refusal, not a server error').toBeLessThan(500);

    // While the address counts: it is in memory only.
    await expectAddressNowhere(addresses, 'while the address counts');

    // Just past a minute after its last check, the address no longer counts.
    await sleep(lastCheckAt + 62_000 - Date.now());
    const after = await sendRaw({ body: { text: offer.text }, pace: false });
    expect(after.status, 'ROW-069: a check sent 62 s after the last one is accepted — the address no longer counts').toBe(200);

    await expectAddressNowhere(addresses, 'after the address stopped counting');
  } finally {
    await hold.release();
  }
});
