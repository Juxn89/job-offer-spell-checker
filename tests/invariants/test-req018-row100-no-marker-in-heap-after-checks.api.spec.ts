// Purpose: ROW-100 (REQ-018) — after the checks of a marker offer finish, a forced garbage collection and a
// heap snapshot of the server process find no string holding any form of the markers.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018 ("held in
// memory only while its check runs"), A-008 and D-003; fresh markers per run; no expected value comes from
// the product.
//
// Test argument
// ROW-100 promise: after the checks of a marker offer finish, a forced garbage collection followed by a heap
//   snapshot of the server finds no string containing the marker (REQ-018 "held in memory only while its check
//   runs and never written to ... a cache"; A-008 "never stored"; D-003 "the offer's text lives only in the
//   request's memory").
// ROW-100 wrong product: a checker that memoises its verdicts and suggestions per word in a module-level Map
//   (so every unknown word ever checked — the marker among them — lives for the process's life), or a server
//   that keeps the last N request bodies in a ring buffer for debugging.
// ROW-100 given: a fresh marker offer (an unknown flagged word, a title-case pseudo-name, an accented phrase —
//   all within the first 300 characters, inside V8's 1,024-character snapshot name limit); when: it is checked
//   twice and both answers have arrived; then: the snapshot, taken after a forced collection through the
//   process's own inspector and streamed (never written), holds none of the markers' forms (plain, case,
//   JSON-escaped as the snapshot writes non-ASCII, base64).
// ROW-100 controls: the checks returned exactly the offer's two misspellings at their places (the text
//   reached the checker), and the same snapshot holds "healthz" — a string any server routing GET /healthz
//   keeps — so the snapshot was taken of the right process and is searched.
// ROW-100 technique: a planted fresh marker searched for in the live heap after a forced collection, from
//   outside the product's code (Node's documented inspector signal, as an operator would). Honest limit:
//   strings the collector has already freed are not in a snapshot, by design of the row.
// cases: ROW-100 target=ROW-100-no-string-holds-the-marker-in-a-heap-snapshot-after-the-checks control=ROW-100-control-the-checks-flag-the-offer-and-the-snapshot-is-of-the-server

import { expect, test } from '@playwright/test';
import { asActor, byPosition, checkText, freshRandom, holdCheckBudget, placeOf, type Placed } from './harness';
import { heapSnapshotSearch, markerOffer, needleForms, type MarkerOffer } from './privacy-text-helpers';

type Scenario = { offer: MarkerOffer; flagged: Placed[][]; snap: { found: string[]; controlFound: boolean; bytes: number } };
let scenario: Promise<Scenario> | undefined;

function runScenario(): Promise<Scenario> {
  scenario ??= (async () => {
    const rng = freshRandom();
    const offer = markerOffer(rng);
    const needles = needleForms(offer, rng);
    const flagged: Placed[][] = [];
    for (let i = 0; i < 2; i++) flagged.push(byPosition((await checkText(offer.text)).flagged.map(placeOf)));
    // the snapshot pauses the server: no other test's check is sent meanwhile
    const hold = await holdCheckBudget();
    let snap: Scenario['snap'];
    try {
      snap = await heapSnapshotSearch(needles, 'healthz');
    } finally {
      await hold.release();
    }
    return { offer, flagged, snap };
  })();
  return scenario;
}

test('ROW-100-control-the-checks-flag-the-offer-and-the-snapshot-is-of-the-server', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expect(
    { snapshotOverOneMegabyte: s.snap.bytes > 1_000_000, holdsTheServersOwnRoute: s.snap.controlFound },
    `ROW-100 control: the heap snapshot (${s.snap.bytes} bytes) is the server's and is searched`,
  ).toEqual({ snapshotOverOneMegabyte: true, holdsTheServersOwnRoute: true });
  expect(s.flagged, 'ROW-100 control: both checks of the marker offer flag exactly its two misspellings at their places').toEqual([s.offer.flagged, s.offer.flagged]);
});

test('ROW-100-no-string-holds-the-marker-in-a-heap-snapshot-after-the-checks', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expect(s.flagged, 'ROW-100 reach: both checks of the marker offer flag exactly its two misspellings at their places').toEqual([s.offer.flagged, s.offer.flagged]);
  expect(
    s.snap.found,
    `ROW-100: after a forced garbage collection, no string in the server's heap holds ${s.offer.unknown.word}, ${s.offer.name.word} or "${s.offer.phrase.word}" in any form`,
  ).toEqual([]);
});
