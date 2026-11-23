// Purpose: ROW-046 (REQ-021) — a check request of 10,001 characters sent straight to the check endpoint,
// not through the page, is refused; the same text one character shorter is checked to its last word.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-021's
// fail-if; texts built by server-limits-helpers.ts with a fresh seed and fresh non-words per run.
//
// Test argument
// ROW-046 promise: "the limit is enforced by the server for every check request, whatever sends it" —
//   a check request of 10,001 characters sent directly to the server is refused (REQ-021 fail-if arm 4;
//   A-013 at most 10,000 characters per check).
// ROW-046 wrong product: the limit lives only in the page's script (a counter or maxlength), so a script
//   posting to /api/check gets 10,001 characters — or any amount — checked; or the server cuts the text
//   to 10,000 and answers its flags.
// ROW-046 given: a 10,000-character offer opening and closing with fresh non-words, and the same text
//   with one more letter on its last word (10,001); when: the 10,001-character text is POSTed as D-020
//   JSON; then: the answer is a refusal (4xx or 503) carrying no D-020 answer — nothing checked, nothing
//   cut and answered.
// ROW-046 controls: the 10,000-character text, sent the same way, is answered 200 with exactly its two
//   non-words flagged at their offsets — the door, the JSON and the length up to the limit all work, and
//   the only difference in the refused request is the one character over.
// ROW-046 technique: values just either side of the threshold, the near miss being the same text.
// cases: ROW-046 target=ROW-046-a-check-request-of-10001-characters-sent-directly-is-refused control=ROW-046-control-the-same-text-at-10000-characters-is-checked-to-its-last-word

import { expect, test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom, sendRaw } from './harness';
import { CHARACTER_LIMIT, asCheckAnswer, flagsOf, graphemeCount, isRefusal, offerOfLength } from './server-limits-helpers';

test('ROW-046-a-check-request-of-10001-characters-sent-directly-is-refused', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text: atLimit } = offerOfLength(rng, CHARACTER_LIMIT, { first: freshNonWord(rng), last: freshNonWord(rng) });
  const over = atLimit + 'z';
  expect(graphemeCount(over), 'ROW-046 setup: the request carries 10,001 characters').toBe(CHARACTER_LIMIT + 1);

  const res = await sendRaw({ body: { text: over } });
  expect(
    { status: res.status, refused: isRefusal(res), checkedAnswer: asCheckAnswer(res.body) !== null },
    `ROW-046: a 10,001-character check request sent directly is refused, not checked (answer ${res.status}: ${res.body.slice(0, 200)})`,
  ).toEqual({ status: res.status, refused: true, checkedAnswer: false });
});

test('ROW-046-control-the-same-text-at-10000-characters-is-checked-to-its-last-word', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, first, last } = offerOfLength(rng, CHARACTER_LIMIT, { first: freshNonWord(rng), last: freshNonWord(rng) });

  const res = await sendRaw({ body: { text } });
  expect(res.status, `ROW-046 control: a 10,000-character check request is answered as checked (${res.body.slice(0, 200)})`).toBe(200);
  const answer = asCheckAnswer(res.body);
  expect(answer, 'ROW-046 control: the answer is the D-020 shape').not.toBeNull();
  expect(flagsOf(answer!), `ROW-046 control: exactly the first and the last word are flagged, at their offsets (seed ${rng.seed})`).toEqual([first, last]);
});
