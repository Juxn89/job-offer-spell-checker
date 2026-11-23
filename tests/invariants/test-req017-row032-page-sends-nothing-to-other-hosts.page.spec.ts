// Purpose: ROW-032 (REQ-017) — in every browser of the harness, from the moment a marker offer is entered
// through its check, the highlights, the minutes' quiet after and leaving the page, the page sends no request,
// opens no socket and hints no connection to any host but the product's own server.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-017's fail-if,
// A-008 and A-033; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-032 promise: no network request the page sends during and after a check of an offer carrying a unique
//   marker goes to any host other than our own server (REQ-017 fail-if "appears in any network request the
//   page ... sends to any host other than the product's own server"; A-008 "it never goes to an outside
//   company"; A-033).
// ROW-032 wrong product: a page that loads an analytics or error-reporting script which, on the check's answer
//   or when the page is hidden, beacons the page state (the box's text, or the flagged words) to its vendor's
//   host — or that sends the text to an outside grammar API from the browser while also calling our server.
// ROW-032 given: a fresh marker offer; when: it is entered, Revisar ortografía is pressed, the highlights are
//   awaited, the page is watched until quiet, then left for the privacy note (pagehide and visibility beacons
//   fire); then: every request the context recorded from the entry on — pages, frames, workers, service
//   workers, WebSockets, RTCPeerConnection ICE servers, WebTransport, preconnect and dns-prefetch hints — names
//   the product's own host, so the marker went to no other.
// ROW-032 controls: the page highlights the marker word (the check really ran) and the recorder holds the
//   page's own POST /api/check carrying the marker in its body — the recorder sees requests and their bodies.
// ROW-032 technique: a recorder over every request door the engine exposes, on the engine door, per browser of
//   the harness (RULE-014); the harness network has no route out (D-023), and requests are recorded before the
//   network is tried, so an attempt toward an outside host is seen even though it cannot succeed.
// cases: ROW-032 target=ROW-032-no-request-to-another-host-during-and-after-a-marker-check control=ROW-032-control-the-recorder-sees-the-check-carrying-the-marker

import { expect, test, type Page } from '@playwright/test';
import { asActor, CHECK_PATH, enterOffer, freshRandom, openChecker, pressCheck, PRODUCT_URL, readHighlights } from './harness';
import { isOwnServer, markerOffer, recordRequests, type MarkerOffer, type SentRequest } from './privacy-text-helpers';

async function markerHighlighted(page: Page, offer: MarkerOffer, row: string): Promise<void> {
  await expect
    .poll(async () => (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word), {
      message: `${row} reach: the page highlights the marker word ${offer.unknown.word}`,
      timeout: 15_000,
    })
    .toContain(offer.unknown.word);
}

// Waits until the recorder has seen no new request for 3 s (at most 20 s): the page is quiet.
async function quiet(sent: SentRequest[]): Promise<void> {
  const began = Date.now();
  let last = sent.length;
  let since = Date.now();
  while (Date.now() - began < 20_000) {
    await new Promise((r) => setTimeout(r, 250));
    if (sent.length !== last) {
      last = sent.length;
      since = Date.now();
    } else if (Date.now() - since >= 3_000) return;
  }
}

test('ROW-032-control-the-recorder-sees-the-check-carrying-the-marker', async ({ page, context }) => {
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  const rec = await recordRequests(context);
  await openChecker(page);
  await enterOffer(page, offer.text);
  await pressCheck(page);
  await markerHighlighted(page, offer, 'ROW-032 control');
  const checks = rec.sent.filter((r) => r.method === 'POST' && r.url.startsWith(PRODUCT_URL + CHECK_PATH));
  expect(
    checks.map((r) => ({ toOwnServer: isOwnServer(r.url, PRODUCT_URL), carriesMarker: r.postData.includes(offer.unknown.word) })),
    'ROW-032 control: the recorder holds the page\'s own check, to our server, carrying the marker in its body',
  ).toEqual([{ toOwnServer: true, carriesMarker: true }]);
});

test('ROW-032-no-request-to-another-host-during-and-after-a-marker-check', async ({ page, context }) => {
  test.setTimeout(180_000);
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  const rec = await recordRequests(context); // before the page loads, so its init script wraps the page's sockets
  await openChecker(page);
  const from = rec.sent.length; // the row's window opens when the offer is entered
  await enterOffer(page, offer.text);
  await pressCheck(page);
  await markerHighlighted(page, offer, 'ROW-032');
  await quiet(rec.sent);
  await rec.linkHints(page);
  await rec.collectPageSide(page);
  await page.goto('/privacidad', { waitUntil: 'load' }); // the checker page is hidden and unloaded: its beacons fire now
  await quiet(rec.sent);
  await rec.linkHints(page);
  await rec.collectPageSide(page);
  const elsewhere = rec.sent
    .filter((r, i) => i >= from || r.kind !== 'request')
    .filter((r) => !isOwnServer(r.url, PRODUCT_URL))
    .map((r) => ({ kind: r.kind, method: r.method, url: r.url.slice(0, 200), carriesMarker: r.postData.includes(offer.unknown.word) || r.url.includes(offer.unknown.word) }));
  expect(rec.sent.length, 'ROW-032 setup: the recorder saw the page\'s own requests').toBeGreaterThan(1);
  expect(elsewhere, `ROW-032: from entering the marker offer until after leaving the page, nothing went to a host other than ${new URL(PRODUCT_URL).host}`).toEqual([]);
});
