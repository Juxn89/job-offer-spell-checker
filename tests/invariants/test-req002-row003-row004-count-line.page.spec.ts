// Purpose: ROW-003 and ROW-004 (REQ-002) — on the checker page, in every browser of the harness, the count
// line states exactly the number of highlighted words after a check, and an offer with no misspelling
// shows the no-spelling-errors statement with nothing highlighted (while an offer with one does not).
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words) from REQ-002's fail-if
// and A-005; misspellings are fresh non-words (harness freshNonWord, checked against dictionary-es 4.0.0)
// and every expected count and position is the test's own record of what it placed, never the product's.
//
// Test argument
// ROW-003 promise: after a check, the line above the text states how many words are flagged, and that
//   count equals the number of highlighted words (REQ-002 fail-if arms 1 and 2: "the line is missing, its
//   count differs from the number of highlighted words"; A-005 "a line says how many words were flagged").
// ROW-003 wrong product: a count line that counts distinct flagged words (or the endpoint's distinct
//   words) while the page highlights every occurrence — with one misspelling written twice the page shows
//   4 highlights and the line says 3; or a line that keeps a stale or fixed number.
// ROW-003 given: three fresh non-words, the first written twice, among correct filler words — 4 expected
//   highlights at the test's own offsets; when: the text is entered in the box (data-element="offer") and
//   Revisar ortografía is pressed; then: the page shows exactly those 4 highlights and the count line
//   (data-element="count") is visible and states exactly one number, 4 — and before the press it stated
//   no 4.
// ROW-003 controls: one fresh non-word written once gives one highlight and a line stating 1 — the page,
//   the check and both readings work, and a distinct-word counter passes it, so only the target
//   separates counting occurrences from counting words.
// ROW-003 technique: a repeat as the decoy (occurrences ≠ distinct words), fresh words each run, the
//   highlights compared as a whole list and the count read in the same poll as the highlights.
// cases: ROW-003 target=ROW-003-count-line-states-exactly-the-number-of-highlighted-words-with-a-repeated-misspelling control=ROW-003-ROW-004-control-one-misspelling-one-highlight-and-a-count-of-one
//
// ROW-004 promise: an offer with no misspelling shows the statement that no spelling errors were found
//   and no highlight (REQ-002 fail-if arm 3: "an offer with no misspelling shows no message or any
//   highlight"; A-005 "No spelling errors found"); the statement is the count line's ("a line … states
//   how many words are flagged, or states that no spelling errors were found").
// ROW-004 wrong product: a page that shows the no-errors line whenever it has drawn no highlight — before
//   any check, or after any check (the placeholder's "nothing flagged" read as clean) — or that keeps
//   showing it beside highlights; or one that says nothing at all for a clean offer.
// ROW-004 given: a text of correct filler words only, then the same page with one fresh non-word added;
//   when: Revisar ortografía is pressed for each; then: for the clean text the count line is visible and
//   says no spelling errors were found (a negation and "errores/faltas/ortografía", no number but 0) with
//   no highlight; for the near miss the line no longer says so, states 1, and the one highlight stands
//   at its offsets — and before the first press the line did not say so.
// ROW-004 controls: the shared control case (one misspelling → one highlight, count 1) shows the page
//   draws highlights and a count, so "no highlight" in the target is a reading of a working page.
// ROW-004 technique: before/after plus a near-miss decoy on the same page (a clean text and the same
//   text with one misspelling), so a line that says "no errors" regardless of the result fails.
// cases: ROW-004 target=ROW-004-a-clean-offer-shows-the-no-spelling-errors-line-and-no-highlight-and-a-near-miss-does-not control=ROW-003-ROW-004-control-one-misspelling-one-highlight-and-a-count-of-one

import { expect, test } from '@playwright/test';
import {
  asActor,
  enterOffer,
  fillerWords,
  freshNonWord,
  freshRandom,
  openChecker,
  pressCheck,
  readHighlights,
  type Highlight,
  type Placed,
} from './harness';
import { layout, readCountLine } from './words-helpers';

const WAIT_MS = 15_000;
const shown = (p: Placed): Highlight => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true });

test('ROW-003-count-line-states-exactly-the-number-of-highlighted-words-with-a-repeated-misspelling', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const a = freshNonWord(rng);
  let b = freshNonWord(rng);
  while (b === a) b = freshNonWord(rng);
  let c = freshNonWord(rng);
  while (c === a || c === b) c = freshNonWord(rng);
  const { text, items } = layout(rng, rng.shuffle([a, a, b, c]).map((word) => ({ word })));
  const expected = items.map(shown);
  expect(expected.length, 'ROW-003 setup: four misspelled occurrences, three distinct words').toBe(4);

  await openChecker(page);
  await enterOffer(page, text);
  const before = await readCountLine(page);
  expect(before.visible && before.numbers.includes(4), `ROW-003: before the press the count line states no 4 (it read ${JSON.stringify(before.text)})`).toBe(false);

  const { status } = await pressCheck(page);
  expect(status, "ROW-003: the page's check request is answered").toBe(200);
  await expect
    .poll(async () => {
      const line = await readCountLine(page);
      return { highlights: await readHighlights(page, text), countLine: { visible: line.visible, numbers: line.numbers } };
    }, {
      message: `ROW-003: in ${JSON.stringify(text)} the 4 misspelled occurrences are highlighted and the count line states exactly 4 (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual({ highlights: expected, countLine: { visible: true, numbers: [4] } });
});

test('ROW-004-a-clean-offer-shows-the-no-spelling-errors-line-and-no-highlight-and-a-near-miss-does-not', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const fillers = fillerWords();
  const words: string[] = [];
  for (let i = 0; i < 12; i++) words.push(rng.pick(fillers));
  const clean = words.join(' ') + '.';
  const miss = freshNonWord(rng);
  const at = 1 + rng.int(words.length - 1);
  const dirtyWords = [...words.slice(0, at), miss, ...words.slice(at)];
  const dirty = dirtyWords.join(' ') + '.';
  const missStart = dirtyWords.slice(0, at).join(' ').length + 1;
  const expectedDirty: Highlight[] = [{ word: miss, start: missStart, end: missStart + miss.length, visible: true, marked: true }];
  expect(dirty.slice(missStart, missStart + miss.length), 'ROW-004 setup: the near miss stands where recorded').toBe(miss);

  await openChecker(page);
  await enterOffer(page, clean);
  const before = await readCountLine(page);
  expect(before.visible && before.noErrors, `ROW-004: before any check the page does not already say no spelling errors were found (it read ${JSON.stringify(before.text)})`).toBe(false);

  expect((await pressCheck(page)).status, "ROW-004: the page's check of the clean offer is answered").toBe(200);
  await expect
    .poll(async () => {
      const line = await readCountLine(page);
      return { highlights: await readHighlights(page, clean), countLine: { visible: line.visible, saysNoErrors: line.noErrors } };
    }, {
      message: `ROW-004: for the clean offer ${JSON.stringify(clean)} the count line says no spelling errors were found and nothing is highlighted (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual({ highlights: [], countLine: { visible: true, saysNoErrors: true } });

  await enterOffer(page, dirty);
  expect((await pressCheck(page)).status, "ROW-004: the page's check of the near miss is answered").toBe(200);
  await expect
    .poll(async () => {
      const line = await readCountLine(page);
      return { highlights: await readHighlights(page, dirty), countLine: { visible: line.visible, saysNoErrors: line.noErrors, numbers: line.numbers } };
    }, {
      message: `ROW-004: with "${miss}" added the line no longer says no errors, it states 1, and "${miss}" is highlighted where it stands (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual({ highlights: expectedDirty, countLine: { visible: true, saysNoErrors: false, numbers: [1] } });
});

test('ROW-003-ROW-004-control-one-misspelling-one-highlight-and-a-count-of-one', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, items } = layout(rng, [{ word: freshNonWord(rng) }]);
  const expected = items.map(shown);

  await openChecker(page);
  await enterOffer(page, text);
  expect((await pressCheck(page)).status, "ROW-003/ROW-004 control: the page's check request is answered").toBe(200);
  await expect
    .poll(async () => {
      const line = await readCountLine(page);
      return { highlights: await readHighlights(page, text), countLine: { visible: line.visible, numbers: line.numbers } };
    }, {
      message: `ROW-003/ROW-004 control: "${items[0].word}" is highlighted where it stands and the count line states 1 (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual({ highlights: expected, countLine: { visible: true, numbers: [1] } });
});
