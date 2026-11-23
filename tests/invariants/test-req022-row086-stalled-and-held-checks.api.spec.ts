// Purpose: ROW-086 (REQ-022, REQ-024) — a connection that stalls before completing a check request is
// closed by the server after a timeout; one address cannot hold more than a small fixed number of check
// requests in flight, and a second address is still answered while it tries.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from the row;
// requests are written here byte by byte on raw sockets; the second writer's offer and loopback address
// are fresh per run.
//
// Test argument
// ROW-086 promise: a stalled check request is closed after a timeout, and one address cannot hold more
//   than a small fixed number of checks in flight while a second address is still answered (the row;
//   REQ-022 "one script cannot exhaust the checker for every writer"; REQ-024 the checker stays
//   available).
// ROW-086 wrong product: a server on its framework's defaults — a body that never completes is waited on
//   for five minutes (Node's requestTimeout) and headers that never end for a minute or more — so one
//   client opening a few hundred such connections holds the server's sockets and memory; or one that
//   lets a single address keep any number of unanswered check requests open; or one whose defence is a
//   global cap, so the attacker's connections lock out every other writer.
// ROW-086 given: (stall) one connection that sends a check request's headers without their end, one that
//   sends complete headers and a body that stops short of its declared length; (in flight) sixteen check
//   requests from the tests container's address, each with complete headers and a body one byte short,
//   held open; when: the connections are left as they are; then: (stall) the server closes each within
//   60 s; (in flight) within 10 s at most 8 of the sixteen are still held open unanswered — the rest
//   refused or closed — and a check from a fresh loopback address inside the product's container (a
//   second writer) is answered 200 with its non-word flagged within 5 s while they are held.
// ROW-086 controls: the control case sends the second writer's check with nothing held — answered with
//   its non-word flagged — so the door and the checker work and only the held requests differ.
// ROW-086 technique: the attack itself, made on raw sockets at the threshold's far side (16 against a
//   ceiling of 8), plus the neighbouring entity — the second address — that must stay served. The bounds
//   are the test's reading of the row's unquantified terms: "a timeout" at most 60 s, "a small fixed
//   number" at most 8.
// cases: ROW-086 target=ROW-086-one-address-cannot-hold-more-than-a-few-checks-in-flight-and-a-second-address-is-answered control=ROW-086-control-a-second-address-is-answered-with-nothing-held

import { connect, type Socket } from 'node:net';
import { expect, test } from '@playwright/test';
import { asActor, freshRandom, takeCheckSlot } from './harness';
import { PRODUCT_HOST, PRODUCT_PORT, asCheckAnswer, checkRequestFrom, flagsOf, freshLoopback, ordinaryOffer, sendFromAddresses, sleep } from './server-limits-helpers';

const STALL_CLOSED_WITHIN_MS = 60_000;
const HELD = 16;
const SMALL_FIXED_NUMBER = 8;
const SETTLE_WITHIN_MS = 10_000;
const SECOND_WRITER_WITHIN_MS = 5_000;

type Held = { socket: Socket; opened: number; answered: boolean; closedAt: number | null };

/** Opens a connection to the product and writes `head` (and nothing more); tracks its answer and its close. */
function holdOpen(head: string): Promise<Held> {
  return new Promise<Held>((resolve, reject) => {
    const socket = connect({ host: PRODUCT_HOST, port: PRODUCT_PORT });
    const h: Held = { socket, opened: 0, answered: false, closedAt: null };
    socket.on('data', () => {
      h.answered = true;
    });
    socket.on('end', () => {
      if (h.closedAt === null) h.closedAt = Date.now();
    });
    socket.on('close', () => {
      if (h.closedAt === null) h.closedAt = Date.now();
    });
    socket.on('error', () => {
      if (h.closedAt === null) h.closedAt = Date.now();
    });
    socket.once('connect', () => {
      h.opened = Date.now();
      socket.write(head, () => resolve(h));
    });
    socket.once('error', (e) => {
      if (!h.opened) reject(new Error(`setup: cannot connect to the product (${e.message})`));
    });
  });
}

const headersWithoutEnd = () => `POST /api/check HTTP/1.1\r\nHost: ${PRODUCT_HOST}:${PRODUCT_PORT}\r\nContent-Type: application/json\r\n`;
const bodyOneByteShort = () => {
  const body = '{"text":"buscamos persona"}';
  return `POST /api/check HTTP/1.1\r\nHost: ${PRODUCT_HOST}:${PRODUCT_PORT}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body.slice(0, -1)}`;
};

test('ROW-086-a-stalled-check-request-is-closed-by-the-server-after-a-timeout', async () => {
  test.setTimeout(180_000);
  asActor('anonymous');
  await takeCheckSlot();
  await takeCheckSlot();
  const stalled = [
    { name: 'headers never ended', held: await holdOpen(headersWithoutEnd()) },
    { name: 'body never completed', held: await holdOpen(bodyOneByteShort()) },
  ];
  const deadline = Date.now() + STALL_CLOSED_WITHIN_MS + 2_000;
  while (Date.now() < deadline && stalled.some((s) => s.held.closedAt === null)) await sleep(250);
  const report = stalled.map((s) => ({
    stall: s.name,
    closedByServerWithinBound: s.held.closedAt !== null && s.held.closedAt - s.held.opened <= STALL_CLOSED_WITHIN_MS,
    closedAfterMs: s.held.closedAt === null ? null : s.held.closedAt - s.held.opened,
  }));
  for (const s of stalled) s.held.socket.destroy();
  expect(
    report.map((r) => ({ stall: r.stall, closedByServerWithinBound: r.closedByServerWithinBound })),
    `ROW-086: the server closes a stalled check request within ${STALL_CLOSED_WITHIN_MS / 1000} s (${JSON.stringify(report)})`,
  ).toEqual(stalled.map((s) => ({ stall: s.name, closedByServerWithinBound: true })));
});

test('ROW-086-one-address-cannot-hold-more-than-a-few-checks-in-flight-and-a-second-address-is-answered', async () => {
  test.setTimeout(400_000);
  asActor('anonymous');
  const rng = freshRandom();
  for (let i = 0; i < HELD; i++) await takeCheckSlot();
  const held: Held[] = [];
  try {
    for (let i = 0; i < HELD; i++) held.push(await holdOpen(bodyOneByteShort()));
    const stillHeld = () => held.filter((h) => h.closedAt === null && !h.answered).length;
    const until = Date.now() + SETTLE_WITHIN_MS;
    while (Date.now() < until && stillHeld() > SMALL_FIXED_NUMBER) await sleep(100);
    const heldAfterSettle = stillHeld();

    const second = ordinaryOffer(rng);
    const [answer] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), second.text)], { timeoutMs: 30_000 });
    const parsed = answer.status === 200 ? asCheckAnswer(answer.body ?? '') : null;
    const secondWriter = {
      status: answer.status,
      flagged: parsed && flagsOf(parsed),
      prompt: answer.ms <= SECOND_WRITER_WITHIN_MS,
    };
    const heldWhileSecondWrote = stillHeld();

    expect(
      { atMostTheSmallNumberHeld: heldAfterSettle <= SMALL_FIXED_NUMBER, secondWriter },
      `ROW-086: of ${HELD} unfinished check requests from one address at most ${SMALL_FIXED_NUMBER} stay held after ${SETTLE_WITHIN_MS / 1000} s (held: ${heldAfterSettle}, still ${heldWhileSecondWrote} while the second address checked), and a second address is answered (${answer.error ?? (answer.body ?? '').slice(0, 160)}, ${answer.ms} ms)`,
    ).toEqual({ atMostTheSmallNumberHeld: true, secondWriter: { status: 200, flagged: [second.nonWord], prompt: true } });
  } finally {
    for (const h of held) h.socket.destroy();
  }
});

test('ROW-086-control-a-second-address-is-answered-with-nothing-held', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = ordinaryOffer(rng);
  const [answer] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), offer.text)]);
  const parsed = answer.status === 200 ? asCheckAnswer(answer.body ?? '') : null;
  expect(
    { status: answer.status, flagged: parsed && flagsOf(parsed), prompt: answer.ms <= SECOND_WRITER_WITHIN_MS },
    `ROW-086 control: a check from a second address is answered with its non-word flagged (${answer.error ?? (answer.body ?? '').slice(0, 160)})`,
  ).toEqual({ status: 200, flagged: [offer.nonWord], prompt: true });
});
