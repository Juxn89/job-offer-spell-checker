// Purpose: ROW-123 (REQ-001, REQ-011, INV-001) — on the checker page, in every browser of the harness,
// highlights stand at their words' exact offsets and choosing a suggestion replaces exactly the flagged
// word, when astral emoji, ZWJ sequences, combining marks, decomposed accents, zero-width and bidi control
// characters come before and inside the text.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); misspellings are fresh
// non-words (harness freshNonWord) and REQ-001's example gestion, whose one correction gestión comes from
// dictionary-es 4.0.0 through the harness oracle; every expected offset and the expected text after the
// replacement are the test's own record, computed in UTF-16 code units as D-020 defines them.
//
// Test argument
// ROW-123 promise: highlight and Replace positions stay exact when astral emoji, ZWJ sequences, combining
//   marks, decomposed accents, zero-width and bidi control characters come before or inside the text
//   (ROW-123, origin domain; REQ-001: highlighted at its own position; REQ-011: Replace changes only that
//   occurrence, every other character unchanged; INV-001: the text differs from what was pasted only at
//   the replaced words; D-020: offsets are UTF-16 code units of the text exactly as sent).
// ROW-123 wrong product: a page or endpoint that counts code points (or bytes, or grapheme clusters), or
//   NFC-normalises the text before checking or replacing — then after "🙂 👩‍💻" every highlight is drawn
//   one to several characters to the left of its word, and Replace writes gestión over the wrong
//   characters (or recomposes "té" + U+0301 elsewhere in the text), changing characters the writer never
//   chose.
// ROW-123 given: a text that opens with a BOM and an astral emoji, holds a ZWJ family/profession sequence,
//   a skin-tone modified emoji, a zero-width space, an RLM and a right-to-left isolate (U+2067 … U+2069),
//   a decomposed "técnico" (e + U+0301) and a combining diaeresis, with three misspellings after them —
//   two fresh non-words and gestion; when: the text is entered, Revisar ortografía pressed, then gestion's
//   highlight opened and its suggestion gestión chosen; then: the three misspellings are highlighted at
//   exactly their UTF-16 offsets (no highlight on any filler); after the choice the box holds exactly the
//   text with that one span replaced — every emoji, mark and control character where it was — and the
//   two other highlights still stand at exactly their offsets.
// ROW-123 controls: the same steps on a plain-ASCII text (no character outside the BMP, nothing
//   decomposed) — highlights, choice and replacement work; an offset-counting fault cannot show there,
//   so only the target separates UTF-16 offsets from code points or normalised text.
// ROW-123 technique: hostile characters at the boundary, offsets compared exactly per highlight and the
//   whole box text compared after the replacement (a byte-exact before/after relation, INV-001). Only
//   highlights touching a filler or a misspelling are judged; whether the decomposed or emoji-adjacent
//   tokens are themselves flagged is not this row's promise.
// cases: ROW-123 target=ROW-123-highlights-and-replace-stay-exact-around-emoji-zwj-combining-zero-width-and-bidi-characters control=ROW-123-control-highlights-and-replace-are-exact-in-a-plain-text

import { expect, test, type Page } from '@playwright/test';
import {
  asActor,
  compose,
  enterOffer,
  fillerWords,
  freshNonWord,
  freshRandom,
  isDictionaryWord,
  openChecker,
  pressCheck,
  readHighlights,
  type Highlight,
  type Placed,
} from './harness';
import { chooseSuggestion, operate, readBox, theFlag } from './words-helpers';

const WAIT_MS = 15_000;
const shown = (p: Placed): Highlight => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true });

/** Highlights touching one of the judged spans (fillers and misspellings), plus any the page could not place. */
async function judgedHighlights(page: Page, text: string, judged: readonly Placed[]): Promise<Highlight[]> {
  const all = await readHighlights(page, text);
  return all.filter((h) => h.start < 0 || judged.some((j) => h.start < j.end && j.start < h.end));
}

async function run(page: Page, tokens: string[], seps: string[], misspelled: string[], seed: number, label: string) {
  if (!isDictionaryWord('gestión') || isDictionaryWord('gestion')) throw new Error('setup: the dictionary oracle disagrees on gestión/gestion');
  const { text, placed } = compose(tokens, seps);
  const fillers = new Set(fillerWords());
  const judged = placed.filter((p) => fillers.has(p.word) || misspelled.includes(p.word));
  const expected = placed.filter((p) => misspelled.includes(p.word)).map(shown);
  expect(expected.length, `${label} setup: each misspelling stands once`).toBe(misspelled.length);
  const g = placed.find((p) => p.word === 'gestion') as Placed;

  await openChecker(page);
  await enterOffer(page, text);
  expect(await readBox(page), `${label}: the box holds the text exactly as entered`).toBe(text);
  expect((await pressCheck(page)).status, `${label}: the page's check request is answered`).toBe(200);
  await expect
    .poll(() => judgedHighlights(page, text, judged), {
      message: `${label}: ${misspelled.join(', ')} are highlighted at exactly their UTF-16 offsets in ${JSON.stringify(text)} (seed ${seed})`,
      timeout: WAIT_MS,
    })
    .toEqual(expected);

  await operate(page, await theFlag(page, 'gestion'));
  await chooseSuggestion(page, 'gestión');
  const after = text.slice(0, g.start) + 'gestión' + text.slice(g.end);
  await expect
    .poll(() => readBox(page), {
      message: `${label}: choosing gestión changes exactly the span of gestion and no other character (seed ${seed})`,
      timeout: WAIT_MS,
    })
    .toBe(after);
  const remaining = expected.filter((h) => h.word !== 'gestion');
  await expect
    .poll(() => judgedHighlights(page, after, judged), {
      message: `${label}: after the replacement the other highlights stand at exactly their offsets (seed ${seed})`,
      timeout: WAIT_MS,
    })
    .toEqual(remaining);
}

test('ROW-123-highlights-and-replace-stay-exact-around-emoji-zwj-combining-zero-width-and-bidi-characters', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const f = () => rng.pick(fillerWords());
  const a = freshNonWord(rng);
  let b = freshNonWord(rng);
  while (b === a) b = freshNonWord(rng);
  const tokens = [
    '﻿🙂', // BOM and an astral emoji before the text
    '👩‍💻', // a ZWJ sequence
    f(),
    a,
    f(),
    '⁧' + f() + '⁩', // a right-to-left isolate around a word
    'técnico', // a decomposed accent
    f(),
    'gestion',
    '👍🏽', // an emoji with a skin-tone modifier (two astral code points)
    f(),
    'ü', // a combining diaeresis on its own letter
    '‏' + f(), // a right-to-left mark before a word
    b,
    f(),
  ];
  const seps = [' ', ' ', ' ', ' ', '​ ', ' ', ' ', ' ', ' ', ' ', '\n', ' ', ' ', ' '];
  await run(page, tokens, seps, [a, 'gestion', b], rng.seed, 'ROW-123');
});

test('ROW-123-control-highlights-and-replace-are-exact-in-a-plain-text', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const f = () => rng.pick(fillerWords().filter((w) => /^[a-z]+$/.test(w)));
  const a = freshNonWord(rng);
  let b = freshNonWord(rng);
  while (b === a) b = freshNonWord(rng);
  const tokens = [f(), f(), a, f(), f(), 'gestion', f(), f(), b, f()];
  const seps = tokens.slice(1).map(() => ' ');
  await run(page, tokens, seps, [a, 'gestion', b], rng.seed, 'ROW-123 control');
});
