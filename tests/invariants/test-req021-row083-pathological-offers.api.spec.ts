// Purpose: ROW-083 (REQ-021, REQ-023, REQ-025) — pathological offers within the 10,000-character limit (one
// 10,000-letter token, two thousand distinct unknown words, strings built to make URL and email patterns
// backtrack) are each answered or refused within a bound, and an ordinary check sent from a second address
// while each is in flight is still answered promptly.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits); every
// pathological text is generated here with a fresh seed (fresh letters, fresh unknown words), the
// ordinary offers carry fresh non-words; no expected value comes from the product.
//
// Test argument
// ROW-083 promise: offers the limit admits but a naive checker chokes on are answered or refused within
//   the server's check timeout, and a concurrent ordinary check is still answered (the row; REQ-021 the
//   limit, REQ-023 "a last check before publishing is quick enough" — 2 s at the 95th percentile,
//   REQ-025 a check that cannot run is refused with the could-not-run answer, never left hanging).
// ROW-083 wrong product: a checker run on the server's one thread with no bound, so the suggestion
//   search over a 10,000-letter word or two thousand unknown words, or a URL/email regular expression
//   backtracking over "a-a-a-…!", holds the process for minutes — every other writer's check waits
//   behind it, or the server crashes (500) instead of refusing.
// ROW-083 given: six texts of at most 10,000 characters — one 10,000-letter token of fresh random
//   letters, 2,000 distinct fresh four-consonant unknown words, "https://" + "x-"…"!", "www." + "x."…"-",
//   "xxx…@" + "x."…"@", and nine-letter runs joined by "@"; when: each is POSTed from the tests container
//   and, a quarter of a second later, an ordinary offer is checked from a fresh loopback address inside
//   the product's container (a second writer); then: each pathological request is answered (200 with a
//   D-020 answer) or refused (4xx, 503 or 504 — the could-not-run answer) within 30 s, never a crash or
//   no answer, and each ordinary check is answered 200 within 5 s with exactly its non-word flagged.
// ROW-083 controls: the control case sends the ordinary check alone from a second address — answered
//   with its non-word flagged — so the door and the checker work and only the concurrency differs.
// ROW-083 technique: generated adversarial inputs at the limit (fresh each run) plus the neighbouring
//   entity — the second writer — that must stay served. The bounds are the test's reading of "the
//   server's check timeout": 30 s for any one check (well past REQ-023's 2 s), 5 s for the ordinary one.
// cases: ROW-083 target=ROW-083-pathological-offers-are-answered-or-refused-in-bounded-time-and-a-second-writer-is-still-answered control=ROW-083-control-an-ordinary-check-from-a-second-address-is-answered

import { expect, test } from '@playwright/test';
import { asActor, freshRandom, isDictionaryWord, type Rng } from './harness';
import {
  CHARACTER_LIMIT,
  asCheckAnswer,
  checkRequestFrom,
  flagsOf,
  freshLoopback,
  graphemeCount,
  isRefusal,
  ordinaryOffer,
  rawRequest,
  sendFromAddresses,
  sleep,
} from './server-limits-helpers';

const PATHOLOGICAL_BOUND_MS = 30_000;
const ORDINARY_BOUND_MS = 5_000;
const DISPATCH_OFFSET_MS = 250; // lets the pathological request arrive first; not a readiness wait

function pathologicalOffers(rng: Rng): { name: string; text: string }[] {
  const letter = () => 'abcdefghijklmnopqrstuvwxyz'[rng.int(26)];
  const x = letter();
  let token = '';
  while (token.length < CHARACTER_LIMIT) token += letter();

  const consonants = 'bcdfghjklmnpqrstvwz';
  const unknown = new Set<string>();
  while (unknown.size < 2_000) {
    let w = '';
    for (let i = 0; i < 4; i++) w += consonants[rng.int(consonants.length)];
    if (!isDictionaryWord(w)) unknown.add(w);
  }

  const offers = [
    { name: 'one 10,000-letter token', text: token },
    { name: '2,000 distinct unknown words', text: [...unknown].join(' ') },
    { name: 'URL backtracking', text: 'https://' + `${x}-`.repeat(4_995) + '!' },
    { name: 'www backtracking', text: 'www.' + `${x}.`.repeat(4_997) + '-' },
    { name: 'email backtracking', text: x.repeat(4_000) + '@' + `${x}.`.repeat(2_995) + '@' },
    { name: 'at-sign runs', text: (x.repeat(9) + '@').repeat(999) },
  ];
  for (const o of offers) {
    const n = graphemeCount(o.text);
    if (n > CHARACTER_LIMIT || n < CHARACTER_LIMIT - 20) throw new Error(`setup: "${o.name}" is ${n} characters, not at the limit`);
  }
  return offers;
}

test('ROW-083-pathological-offers-are-answered-or-refused-in-bounded-time-and-a-second-writer-is-still-answered', async () => {
  test.setTimeout(540_000);
  asActor('anonymous');
  const rng = freshRandom();
  const rows: Record<string, unknown>[] = [];
  for (const p of pathologicalOffers(rng)) {
    const inFlight = rawRequest({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: p.text }), timeoutMs: 90_000 }).then(
      (r) => ({ status: r.status as number | null, body: r.body, ms: r.ms, error: null as string | null }),
      (e: Error) => ({ status: null as number | null, body: '', ms: null as number | null, error: e.message }),
    );
    await sleep(DISPATCH_OFFSET_MS);
    const ordinary = ordinaryOffer(rng);
    const [second] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), ordinary.text)], { timeoutMs: 60_000 });
    const a = await inFlight;
    const secondAnswer = second.status === 200 ? asCheckAnswer(second.body ?? '') : null;
    const outcome = a.status === null ? `no answer (${a.error})` : asCheckAnswer(a.body) && a.status === 200 ? 'answered' : isRefusal(a) || a.status === 504 ? 'refused' : `error ${a.status}`;
    rows.push({
      offer: p.name,
      outcome,
      withinBound: a.ms !== null && a.ms <= PATHOLOGICAL_BOUND_MS,
      secondWriter: second.status === 200 && secondAnswer !== null && JSON.stringify(flagsOf(secondAnswer)) === JSON.stringify([ordinary.nonWord]) ? 'answered' : `not answered (${second.status ?? second.error})`,
      secondWriterPrompt: second.ms <= ORDINARY_BOUND_MS,
      ms: { pathological: a.ms, secondWriter: second.ms },
    });
  }
  expect(
    rows.filter((r) => !(r.outcome === 'answered' || r.outcome === 'refused') || !r.withinBound || r.secondWriter !== 'answered' || !r.secondWriterPrompt),
    `ROW-083: every pathological offer is answered or refused within ${PATHOLOGICAL_BOUND_MS / 1000} s and a second writer's check is answered within ${ORDINARY_BOUND_MS / 1000} s while it runs (seed ${rng.seed}; all: ${JSON.stringify(rows)})`,
  ).toEqual([]);
});

test('ROW-083-control-an-ordinary-check-from-a-second-address-is-answered', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const ordinary = ordinaryOffer(rng);
  const [res] = await sendFromAddresses([checkRequestFrom(freshLoopback(rng), ordinary.text)]);
  const answer = res.status === 200 ? asCheckAnswer(res.body ?? '') : null;
  expect(
    { status: res.status, flagged: answer && flagsOf(answer), prompt: res.ms <= ORDINARY_BOUND_MS },
    `ROW-083 control: an ordinary check from a second address is answered promptly with its non-word flagged (${res.error ?? (res.body ?? '').slice(0, 200)})`,
  ).toEqual({ status: 200, flagged: [ordinary.nonWord], prompt: true });
});
