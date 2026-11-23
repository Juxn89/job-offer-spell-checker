// Purpose: ROW-045 and ROW-047 (REQ-021) — on the checker page, in every browser of the harness, an offer
// of 10,001 characters is refused with a message naming the 10,000-character limit, unchecked, uncut and
// left in the box; an offer of exactly 10,000 characters is checked to its last word.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-021's
// fail-if and A-013; texts are built by server-limits-helpers.ts with a fresh seed and fresh non-words
// per run, their lengths and word positions recorded before anything is sent.
//
// Test argument
// ROW-045 promise: an offer of more than 10,000 characters is refused with a message naming the limit,
//   nothing is checked or silently cut, and the text stays in the box untouched (REQ-021 fail-if arm 1;
//   A-013 "refused with a message naming the limit, never silently cut").
// ROW-045 wrong product: a page whose box has maxlength=10000 (the paste is cut to 10,000 and checked),
//   or one that sends the first 10,000 characters and highlights what it found, or one that shows a
//   generic error with no limit named.
// ROW-045 given: 10,001 characters of correct filler words, opening and closing with fresh non-words (so
//   any check of any part highlights something); when: the text is entered and Revisar ortografía is
//   pressed; then: a message naming 10,000 is shown, the box holds the 10,001 characters exactly, no
//   highlight and no count line appear, and no check request the page sent was answered 200 or carried
//   anything but the whole text.
// ROW-045 controls: the box holds the whole text before the press, and no limit message is shown before
//   it; ROW-047 (the same construction one character shorter) is checked — the limit is reached exactly.
// ROW-045 technique: values just either side of the threshold (10,001 here, 10,000 in ROW-047), built
//   the same way, on the engine door because the message and the box are what the writer sees.
// cases: ROW-045 target=ROW-045-an-offer-of-10001-characters-is-refused-naming-the-limit-unchecked-uncut-and-untouched control=ROW-047-an-offer-of-exactly-10000-characters-is-checked-to-its-last-word
//
// ROW-047 promise: an offer of exactly 10,000 characters is checked (REQ-021 fail-if: "an offer of
//   exactly 10,000 characters is refused"; the limit is "more than 10,000").
// ROW-047 wrong product: an off-by-one limit (>= 10,000 refused), a box with maxlength 9,999, or a page
//   that checks only the first part of a long text and misses its last word.
// ROW-047 given: exactly 10,000 characters, a fresh non-word as the first word and another as the last;
//   when: entered and Revisar ortografía pressed; then: the page sends the whole text, the answer is 200,
//   exactly the two non-words are highlighted at their own positions, and no limit message is shown.
// ROW-047 controls: nothing is highlighted before the press; the box holds all 10,000 characters.
// ROW-047 technique: the at-threshold value with sentinels at both ends, so a cut at either end shows.
// cases: ROW-047 target=ROW-047-an-offer-of-exactly-10000-characters-is-checked-to-its-last-word control=ROW-045-an-offer-of-10001-characters-is-refused-naming-the-limit-unchecked-uncut-and-untouched

import { expect, test } from '@playwright/test';
import { ROLES, asActor, enterOffer, freshNonWord, freshRandom, openChecker, pressCheck, readHighlights } from './harness';
import {
  CHARACTER_LIMIT,
  NAMES_THE_LIMIT,
  NO_ERRORS,
  expectShown,
  offerOfLength,
  offerValue,
  pressCheckButton,
  visibleText,
  watchChecks,
} from './server-limits-helpers';

test('ROW-045-an-offer-of-10001-characters-is-refused-naming-the-limit-unchecked-uncut-and-untouched', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = offerOfLength(rng, CHARACTER_LIMIT + 1, { first: freshNonWord(rng), last: freshNonWord(rng) });

  await openChecker(page);
  const seen = watchChecks(page);
  await enterOffer(page, text);
  expect((await offerValue(page)).length, 'ROW-045: the box takes the whole 10,001-character offer as pasted — nothing is cut on entry').toBe(text.length);
  expect(await visibleText(page, ROLES.message), 'ROW-045: no message names the limit before Revisar ortografía is pressed').not.toMatch(NAMES_THE_LIMIT);

  await pressCheckButton(page, 'wait');
  await expectShown(page, ROLES.message, NAMES_THE_LIMIT, 'ROW-045: a message naming the 10,000-character limit is shown');

  expect(await visibleText(page, ROLES.message), 'ROW-045: the refusal is not a no-errors result').not.toMatch(NO_ERRORS);
  expect(await offerValue(page), 'ROW-045: the text stays in the box untouched').toBe(text);
  expect(await readHighlights(page, text), 'ROW-045: nothing is highlighted — no part of the offer was checked').toEqual([]);
  expect(await visibleText(page, ROLES.count), 'ROW-045: no count line is shown for a refused offer').toBe('');
  expect(
    seen.map((s) => ({ wholeText: s.text === text, sentLength: s.text?.length ?? null, answeredAsChecked: s.status === 200 })).filter((s) => !s.wholeText || s.answeredAsChecked),
    'ROW-045: no check request was answered as checked, and none carried a cut text',
  ).toEqual([]);
});

test('ROW-047-an-offer-of-exactly-10000-characters-is-checked-to-its-last-word', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, first, last } = offerOfLength(rng, CHARACTER_LIMIT, { first: freshNonWord(rng), last: freshNonWord(rng) });

  await openChecker(page);
  const seen = watchChecks(page);
  await enterOffer(page, text);
  expect(await offerValue(page), 'ROW-047: the box holds all 10,000 characters as entered').toBe(text);
  expect(await readHighlights(page, text), 'ROW-047: nothing is highlighted before Revisar ortografía is pressed').toEqual([]);

  const { status } = await pressCheck(page);
  expect(status, 'ROW-047: the check of exactly 10,000 characters is answered as checked').toBe(200);
  await expect
    .poll(async () => (await readHighlights(page, text)).map((h) => ({ word: h.word, start: h.start, end: h.end })), {
      message: `ROW-047: the first word "${first.word}" and the last word "${last.word}" of the 10,000 characters are highlighted where they stand (seed ${rng.seed})`,
      timeout: 15_000,
    })
    .toEqual([first, last]);
  expect(seen.map((s) => s.text === text), 'ROW-047: the page sent the whole 10,000-character text, once').toEqual([true]);
  expect(await visibleText(page, ROLES.message), 'ROW-047: no message names the limit for an offer within it').not.toMatch(NAMES_THE_LIMIT);
});
