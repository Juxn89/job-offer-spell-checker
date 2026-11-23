// Purpose: ROW-033 (REQ-017) — the server, on the harness's network with no route out, checks a marker offer
// successfully, and its network namespace makes no outbound attempt of any kind — no DNS query, no connection
// to another host, no packet sent toward an unreachable address — during the check or the minute after it.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-017's fail-if,
// A-008, D-002 and D-023; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-033 promise: the server, run with outbound network blocked, checks an offer carrying a unique marker
//   successfully, and makes no outbound connection attempt of any kind (DNS query or connection to any host
//   other than our own) during or after the check (REQ-017 fail-if: "the check uses any outside spelling,
//   language or AI service"; A-008 "it never goes to an outside company"; D-002 the dictionary is vendored;
//   D-023 the ledger network is internal).
// ROW-033 wrong product: a checker that calls an outside spelling web service and, when it
//   fails, falls back to the local dictionary — the check succeeds offline, but every check sends a DNS query
//   and tries the outside host; or a server that ships error or usage telemetry on a 60-second batch.
// ROW-033 given: a fresh marker offer with two misspellings; when: it is checked through the check endpoint
//   while a monitor in the product's network namespace reads the kernel's counters (UDP datagrams sent,
//   packets with no route, ICMP echoes) and polls its socket tables, for the check and 65 s after it; then: the
//   check is answered 200 with exactly the two misspellings at their places, and the counters moved by zero
//   and no socket to a non-loopback peer other than the product's own served port was ever seen.
// ROW-033 controls: before the window, inside the same namespace, one DNS lookup of an outside name and one
//   connection to an outside address (TEST-NET 192.0.2.1) both fail — the network is blocked — and move the
//   counters — the monitor sees exactly the attempts the row forbids.
// ROW-033 technique: an external service's absence proven by blocking it and counting attempts at the kernel,
//   from outside the product process; the 65 s window covers a once-a-minute flush. Honest limit: a socket
//   that opens and closes between two 25 ms polls toward a peer the network can reach is seen only through the
//   counters (a connect to an unreachable outside address counts as no-route; a DNS query counts as UDP).
// cases: ROW-033 target=ROW-033-offline-check-succeeds-and-no-outbound-attempt-during-or-after-it control=ROW-033-control-the-outside-is-unreachable-and-the-counters-see-an-attempt

import { expect, test } from '@playwright/test';
import { asActor, byPosition, checkText, freshRandom, placeOf, PRODUCT_URL, sendRaw, type CheckAnswer } from './harness';
import { markerOffer, networkControl, networkMonitor, takeCheckSlotPatiently } from './privacy-text-helpers';

const WINDOW_MS = 65_000;
const productPort = Number(new URL(PRODUCT_URL).port || 80);

test('ROW-033-control-the-outside-is-unreachable-and-the-counters-see-an-attempt', async () => {
  asActor('anonymous');
  const c = await networkControl();
  expect(
    {
      lookupFailed: c.lookup !== 'resolved',
      connectFailed: c.conn !== 'connected',
      dnsQueryCounted: c.delta.udpOut >= 1,
      connectAttemptCounted: c.delta.noRoute + c.delta.tcpActiveOpens >= 1,
    },
    `ROW-033 control: in the product's namespace an outside lookup (${c.lookup}) and an outside connection (${c.conn}) fail and are counted (${JSON.stringify(c.delta)})`,
  ).toEqual({ lookupFailed: true, connectFailed: true, dnsQueryCounted: true, connectAttemptCounted: true });

  // the control's own path: the product answers a check offline
  const rng = freshRandom();
  const offer = markerOffer(rng);
  const answer = await checkText(offer.text);
  expect(byPosition(answer.flagged.map(placeOf)), 'ROW-033 control: offline, the check flags the offer\'s two misspellings at their places').toEqual(offer.flagged);
});

test('ROW-033-offline-check-succeeds-and-no-outbound-attempt-during-or-after-it', async () => {
  test.setTimeout(300_000);
  asActor('anonymous');
  const rng = freshRandom();
  const offer = markerOffer(rng);
  await takeCheckSlotPatiently(); // the slot first: the window opens only when the check can go at once
  const monitor = await networkMonitor(WINDOW_MS, [productPort]);
  await monitor.ready;
  const res = await sendRaw({ body: { text: offer.text }, pace: false });
  let flagged: unknown = `answered ${res.status}: ${res.body.slice(0, 200)}`;
  try {
    if (res.status === 200) flagged = byPosition((JSON.parse(res.body) as CheckAnswer).flagged.map(placeOf));
  } catch {
    /* kept as the answer's text */
  }
  const seen = await monitor.result;
  expect(flagged, `ROW-033: offline, the check of ${JSON.stringify(offer.text)} flags exactly its two misspellings at their places`).toEqual(offer.flagged);
  expect(
    { dnsQueriesOrUdpSent: seen.delta.udpOut, packetsWithNoRoute: seen.delta.noRoute, icmpEchoes: seen.delta.icmpEcho, socketsToOtherHosts: seen.sockets },
    `ROW-033: during the check and ${WINDOW_MS / 1000} s after it the product's namespace made no outbound attempt`,
  ).toEqual({ dnsQueriesOrUdpSent: 0, packetsWithNoRoute: 0, icmpEchoes: 0, socketsToOtherHosts: [] });
});
