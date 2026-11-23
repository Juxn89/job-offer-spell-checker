// Purpose: ROW-005 and ROW-006 (REQ-003) — through the check endpoint, all-capital words of 5 letters or
// fewer and words containing a digit are never flagged, while an all-capital word longer than 5 letters
// is checked like any other word: one missing its accent (GESTION) is flagged.
// Provenance: generated with fresh randomness (short capitals, digit words, consonant non-words) and from
// tests/invariants/spanish-dictionary.ts (accentPopulation over dictionary-es 4.0.0, pinned), plus
// REQ-003's own examples (SQL, SAP, RRHH, B2B, 3D, GESTION); no expected value comes from the product.
//
// Test argument
// ROW-005 promise: an all-capital word of at most 5 letters (SQL, SAP, RRHH) other than ANO or ANOS, and
//   any word containing a digit (B2B, 3D), is never flagged (REQ-003 fail-if arm 1; A-007, A-051).
// ROW-005 wrong product: a length cut-off off by one (≤ 4 letters exempt, so a 5-letter acronym such as
//   RRHHX is flagged), an exemption only for capitals made of dictionary-free letters, a tokeniser that
//   splits a digit word into letter fragments (kbd4rtz → kbd, rtz, both flagged), or — the other side of
//   the boundary — one that exempts every all-capital word (so a 6-letter one passes unchecked).
// ROW-005 given: ~30 fresh all-capital strings of 1–5 letters (A–Z, Ñ, accented capitals; ANO/ANOS
//   excluded), at least five of exactly 5 letters, and ~20 fresh digit words of several shapes (B2B-like,
//   3D-like, mp3-like, kbd4rtz-like, 24h-like), some opening a sentence; plus two near misses that must
//   be flagged — a fresh 6-letter all-capital consonant non-word (the boundary's other side) and a fresh
//   lower-case non-word; when: the text is sent to POST /api/check; then: the flags are exactly the two
//   near misses, each at its offsets — no exempt word, and no fragment of one, flagged.
// ROW-005 controls: the control case (a fresh non-word flagged at its offsets) shows the endpoint flags;
//   the near misses inside the target show the flagging path is reached in the very text judged.
// ROW-005 technique: a property over generated words on both sides of the 5/6-letter threshold, plus the
//   row's named example (SQL, SAP, RRHH, B2B, 3D) in its own case.
// cases: ROW-005 target=ROW-005-short-capitals-and-digit-words-never-flagged-over-generated-words control=ROW-005-ROW-006-control-a-fresh-non-word-is-flagged-at-its-offsets
//
// ROW-006 promise: an all-capital word longer than 5 letters missing its accent (GESTION) is flagged
//   (REQ-003 fail-if arm 2; REQ-009: a word written entirely in capitals is never taken as a proper noun;
//   A-032), while the same word correctly accented in capitals (GESTIÓN) is not (REQ-001 arm 2).
// ROW-006 wrong product: a checker that exempts every all-capital word as an acronym or brand, or that
//   folds accents for capitals ("capitals often drop accents") and so accepts GESTION.
// ROW-006 given: GESTION (the row's example) and fresh accent-stripped dictionary words in capitals —
//   four of 7+ letters and one of exactly 6 letters (the boundary) — mid-sentence and sentence-initial,
//   beside the correct capital forms of the 7+-letter ones (GESTIÓN …) as near misses; when: the text is
//   sent to POST /api/check; then: the flags are exactly the stripped capital forms at their offsets.
// ROW-006 controls: the shared control case; the correct capital near misses (not flagged) show the
//   flags are not "every capital word".
// ROW-006 technique: dictionary-generated words with the threshold's first flagged length (6) included,
//   plus the row's own GESTION/GESTIÓN example.
// cases: ROW-006 target=ROW-006-capital-words-longer-than-five-letters-missing-their-accent-are-flagged control=ROW-005-ROW-006-control-a-fresh-non-word-is-flagged-at-its-offsets

import { expect, test } from '@playwright/test';
import {
  accentPopulation,
  asActor,
  checkText,
  compose,
  freshNonWord,
  freshRandom,
  isDictionaryWord,
  type Rng,
} from './harness';
import { flagDiff, layout, upperEs, type Item } from './words-helpers';

const CAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ';
const ACCENTED_CAPS = 'ÁÉÍÓÚ';
const CONSONANT_CAPS = 'BCDFGHJKLMNPQRSTVZ';
const lowerConsonants = 'bcdfghjklmnpqrstvz';

function shortCapital(rng: Rng, length: number): string {
  for (;;) {
    let w = '';
    for (let i = 0; i < length; i++) w += rng.int(8) === 0 ? rng.pick([...ACCENTED_CAPS]) : rng.pick([...CAPS]);
    if (w !== 'ANO' && w !== 'ANOS') return w;
  }
}

function run(rng: Rng, alphabet: string, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[rng.int(alphabet.length)];
  return s;
}

function digitWord(rng: Rng): string {
  const d = () => String(rng.int(10));
  switch (rng.int(6)) {
    case 0: return run(rng, CONSONANT_CAPS, 1 + rng.int(2)) + d() + run(rng, CONSONANT_CAPS, 1 + rng.int(2)); // B2B
    case 1: return d() + run(rng, CONSONANT_CAPS, 1); // 3D
    case 2: return run(rng, lowerConsonants, 2 + rng.int(2)) + d(); // mp3
    case 3: return run(rng, lowerConsonants, 3) + d() + run(rng, lowerConsonants, 3); // kbd4rtz
    case 4: return d() + d() + run(rng, lowerConsonants, 1); // 24h
    default: return run(rng, CONSONANT_CAPS, 1) + run(rng, lowerConsonants, 3 + rng.int(3)) + d() + d(); // Bkrtz19
  }
}

function sixLetterCapitalNonWord(rng: Rng): string {
  for (;;) {
    const w = run(rng, CONSONANT_CAPS, 6);
    if (!isDictionaryWord(w) && !isDictionaryWord(w.toLowerCase())) return w;
  }
}

test('ROW-005-short-capitals-and-digit-words-never-flagged-over-generated-words', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const exempt: string[] = [];
  for (let i = 0; i < 6; i++) exempt.push(shortCapital(rng, 5));
  for (let i = 0; i < 24; i++) exempt.push(shortCapital(rng, 1 + rng.int(5)));
  for (let i = 0; i < 20; i++) exempt.push(digitWord(rng));
  const sixCaps = sixLetterCapitalNonWord(rng);
  const lower = freshNonWord(rng);
  const items: Item[] = rng.shuffle([...exempt, sixCaps, lower]).map((word) => ({ word, initial: rng.int(5) === 0 }));
  const { text, items: placed } = layout(rng, items, { min: 0, max: 1 });
  const expected = placed.filter((p) => p.word === sixCaps || p.word === lower);
  expect(expected.length, 'ROW-005 setup: both near misses stand once in the text').toBe(2);

  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, expected),
    `ROW-005: in ${JSON.stringify(text)} no capital word of ≤5 letters and no digit word is flagged; only "${sixCaps}" (6 capitals) and "${lower}" are (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

test('ROW-005-named-example-SQL-SAP-RRHH-B2B-3D-not-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const lower = freshNonWord(rng);
  const { text, placed } = compose(
    ['Buscamos', 'analista', 'SQL', 'con', 'experiencia', 'en', 'SAP', 'y', 'RRHH', 'para', 'empresa', 'B2B', 'de', 'impresión', '3D', 'y', lower],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ', ', ' ', ' ', ' ', ' ', ' ', ', ', ' '],
  );
  const answer = await checkText(text + '.');
  expect(
    flagDiff(text, answer, placed.filter((p) => p.word === lower)),
    `ROW-005: in ${JSON.stringify(text)} SQL, SAP, RRHH, B2B and 3D are not flagged and the fresh "${lower}" is (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

test('ROW-006-capital-words-longer-than-five-letters-missing-their-accent-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const long = rng.shuffle(accentPopulation().filter((p) => p.word !== 'gestión')).slice(0, 4);
  const sixPool = accentPopulation(6).filter((p) => p.word.length === 6);
  const sixIon = sixPool.filter((p) => p.word.endsWith('ión'));
  const six = rng.pick(sixIon.length > 0 ? sixIon : sixPool);
  expect(long.length, 'ROW-006 setup: four 7+-letter population words').toBe(4);

  const flagged = ['GESTION', ...long.map((p) => upperEs(p.stripped)), upperEs(six.stripped)];
  const correct = ['GESTIÓN', ...long.map((p) => upperEs(p.word))];
  for (const w of flagged) if (isDictionaryWord(w)) throw new Error(`setup: the dictionary oracle holds ${w}`);
  for (const w of correct) if (!isDictionaryWord(w)) throw new Error(`setup: the dictionary oracle does not hold ${w}`);

  const items: Item[] = rng.shuffle([...flagged, ...correct]).map((word) => ({ word, initial: rng.int(3) === 0 }));
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => flagged.includes(p.word));
  expect(expected.length, 'ROW-006 setup: every stripped capital form stands once').toBe(flagged.length);

  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, expected),
    `ROW-006: in ${JSON.stringify(text)} exactly ${flagged.join(', ')} are flagged — ${correct.join(', ')} are not (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

test('ROW-005-ROW-006-control-a-fresh-non-word-is-flagged-at-its-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, items),
    `ROW-005/ROW-006 control: the endpoint flags exactly the fresh non-word "${nonWord}" where it stands in ${JSON.stringify(text)}`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});
