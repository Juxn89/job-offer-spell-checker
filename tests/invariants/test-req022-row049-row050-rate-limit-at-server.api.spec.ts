// Purpose: ROW-049 and ROW-050 (REQ-022) — at the check endpoint, sent directly: the 31st check within a
// minute from one address is refused whatever forwarding header it rotates; the 30th is accepted, and a
// check from a second address is answered while the first address is refused.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-022's
// fail-if and A-013; forwarded addresses, loopback addresses and non-words are fresh per run.
//
// Test argument
// ROW-049 promise: the limit "is enforced by the server for every check request, whatever sends it" — a
//   31st check request within a minute from one address, sent directly, is refused, whatever
//   client-controlled header (X-Forwarded-For, Forwarded) it rotates (REQ-022 fail-if arm 4; A-013).
// ROW-049 wrong product: a server that keys its limit on X-Forwarded-For, X-Real-IP or Forwarded as sent
//   by any client, so a script that writes a new address into the header each time is never limited.
// ROW-049 given: the whole check budget held (D-030), 35 checks sent from the tests container's one
//   address within the minute, each carrying a different fresh public address in X-Forwarded-For,
//   Forwarded (IPv4 and IPv6 forms) or X-Real-IP; when: checks 31 to 35 are sent; then: each of them is
//   refused (4xx or 503, no D-020 answer).
// ROW-049 controls: a single check carrying such headers, within the limit, is answered 200 with its
//   non-word flagged — the headers themselves are not what gets refused.
// ROW-049 technique: the threshold's first values over it, with the header rotated on every request so a
//   header-keyed limiter sees 35 different clients.
// cases: ROW-049 target=ROW-049-a-31st-check-is-refused-whatever-forwarding-header-it-rotates control=ROW-049-control-a-check-carrying-forwarding-headers-is-answered
//
// ROW-050 promise: control of ROW-048 — the 30th check within a minute is accepted, and a check from a
//   second address is accepted while the first is refused (REQ-022: "at most 30 checks per minute ...
//   from one network address"; A-013, A-037 one address is one IPv4 address).
// ROW-050 wrong product: an off-by-one limit (the 30th refused); or one global counter for every client,
//   so once one address is limited every writer is refused; or a limiter that a second address's check
//   resets, so the first address is let through again.
// ROW-050 given: the budget held, 30 checks from the tests container's address; then the 31st from it;
//   then one from a fresh loopback address inside the product's container (a second client address);
//   then a 32nd from the first; when/then: checks 1-30 are each answered 200 with a D-020 answer, the
//   31st is refused, the second address's check is answered 200 with its non-word flagged, and the 32nd
//   from the first address is still refused.
// ROW-050 controls: the control case shows the second-address door works on its own — a check sent from
//   a loopback address inside the product's container is answered with its non-word flagged.
// ROW-050 technique: the threshold's last value under it and first over it, plus the neighbouring entity
//   (a second address) that must stay untouched.
// cases: ROW-050 target=ROW-050-the-30th-check-is-accepted-and-a-second-address-is-answered-while-the-first-is-refused control=ROW-050-control-a-check-from-a-second-address-is-answered

import { expect, test } from '@playwright/test';
import { asActor, freshRandom, holdCheckBudget, sendRaw, type Rng } from './harness';
import {
  PER_MINUTE,
  asCheckAnswer,
  checkRequestFrom,
  flagsOf,
  freshLoopback,
  isRefusal,
  ordinaryOffer,
  sendFromAddresses,
} from './server-limits-helpers';

function publicIpv4(rng: Rng): string {
  for (;;) {
    const a = 1 + rng.int(222);
    if (a === 10 || a === 127 || a === 100 || a === 169 || a === 172 || a === 192) continue;
    return `${a}.${rng.int(256)}.${rng.int(256)}.${1 + rng.int(254)}`;
  }
}

function publicIpv6(rng: Rng): string {
  const h = () => rng.int(0x10000).toString(16);
  return `2a0${rng.int(10)}:${h()}:${h()}:${h()}::${h()}`;
}

/** A different client-controlled forwarding header set for each request: every common spelling. */
function rotatingHeaders(rng: Rng, i: number): Record<string, string> {
  switch (i % 5) {
    case 0:
      return { 'x-forwarded-for': publicIpv4(rng) };
    case 1:
      return { forwarded: `for=${publicIpv4(rng)};proto=https` };
    case 2:
      return { 'x-real-ip': publicIpv4(rng), 'x-forwarded-for': `${publicIpv4(rng)}, ${publicIpv4(rng)}` };
    case 3:
      return { forwarded: `for="[${publicIpv6(rng)}]"`, 'x-forwarded-for': publicIpv6(rng) };
    default:
      return { 'x-forwarded-for': `${publicIpv4(rng)}`, 'x-client-ip': publicIpv4(rng), 'cf-connecting-ip': publicIpv4(rng) };
  }
}

test('ROW-049-a-31st-check-is-refused-whatever-forwarding-header-it-rotates', async () => {
  test.setTimeout(500_000);
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = ordinaryOffer(rng);
  const hold = await holdCheckBudget();
  try {
    const within: number[] = [];
    for (let i = 0; i < PER_MINUTE; i++) within.push((await sendRaw({ body: { text }, headers: rotatingHeaders(rng, i), pace: false })).status);
    const over: { headers: Record<string, string>; status: number; refused: boolean }[] = [];
    for (let i = PER_MINUTE; i < PER_MINUTE + 5; i++) {
      const headers = rotatingHeaders(rng, i);
      const res = await sendRaw({ body: { text }, headers, pace: false });
      over.push({ headers, status: res.status, refused: isRefusal(res) });
    }
    expect(
      over.filter((o) => !o.refused),
      `ROW-049: checks 31 to 35 within the minute from this one address are refused whatever forwarding header they carry (the first 30 answered ${JSON.stringify(within)})`,
    ).toEqual([]);
  } finally {
    await hold.release();
  }
});

test('ROW-049-control-a-check-carrying-forwarding-headers-is-answered', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = ordinaryOffer(rng);
  const res = await sendRaw({ body: { text }, headers: { ...rotatingHeaders(rng, 2), forwarded: `for=${publicIpv4(rng)}` } });
  expect(res.status, `ROW-049 control: a check carrying forwarding headers is answered (${res.body.slice(0, 200)})`).toBe(200);
  const answer = asCheckAnswer(res.body);
  expect(answer && flagsOf(answer), 'ROW-049 control: its non-word is flagged where it stands').toEqual([nonWord]);
});

test('ROW-050-the-30th-check-is-accepted-and-a-second-address-is-answered-while-the-first-is-refused', async () => {
  test.setTimeout(500_000);
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = ordinaryOffer(rng);
  const second = ordinaryOffer(rng);
  const hold = await holdCheckBudget();
  try {
    const within: { n: number; status: number; checked: boolean }[] = [];
    for (let i = 1; i <= PER_MINUTE; i++) {
      const res = await sendRaw({ body: { text }, pace: false });
      within.push({ n: i, status: res.status, checked: asCheckAnswer(res.body) !== null });
    }
    expect(within.filter((w) => w.status !== 200 || !w.checked), 'ROW-050: checks 1 to 30 of the minute, the 30th included, are each accepted and answered').toEqual([]);

    const thirtyFirst = await sendRaw({ body: { text }, pace: false });
    expect(isRefusal(thirtyFirst), `ROW-050: the 31st check from the first address is refused (answer ${thirtyFirst.status})`).toBe(true);

    const [other] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), second.text)]);
    const otherAnswer = other.status === 200 ? asCheckAnswer(other.body ?? '') : null;
    expect(
      { status: other.status, flagged: otherAnswer && flagsOf(otherAnswer) },
      `ROW-050: a check from a second address is answered while the first is refused (${other.error ?? (other.body ?? '').slice(0, 200)})`,
    ).toEqual({ status: 200, flagged: [second.nonWord] });

    const thirtySecond = await sendRaw({ body: { text }, pace: false });
    expect(isRefusal(thirtySecond), `ROW-050: the first address is still refused after the second address's check (answer ${thirtySecond.status})`).toBe(true);
  } finally {
    await hold.release();
  }
});

test('ROW-050-control-a-check-from-a-second-address-is-answered', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = ordinaryOffer(rng);
  const [res] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), offer.text)]);
  const answer = res.status === 200 ? asCheckAnswer(res.body ?? '') : null;
  expect(
    { status: res.status, flagged: answer && flagsOf(answer) },
    `ROW-050 control: a check from a loopback address inside the product's container is answered with its non-word flagged (${res.error ?? (res.body ?? '').slice(0, 200)})`,
  ).toEqual({ status: 200, flagged: [offer.nonWord] });
});
