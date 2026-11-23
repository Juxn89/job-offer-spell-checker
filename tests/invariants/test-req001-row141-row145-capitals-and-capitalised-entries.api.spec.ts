// Purpose: ROW-141 and ROW-145 (REQ-001) — through the check endpoint, correct dictionary words written in
// capitals with their capital accents, or in title case, are not flagged over a generated sample; and
// dictionary entries that exist only capitalised (España …), written in lower case, are flagged with the
// capitalised form first.
// Provenance: the sample is generated from tests/invariants/spanish-dictionary.ts (accentPopulation over
// dictionary-es 4.0.0, pinned) with a fresh seed; the capitalised-only entries are hand-listed place names
// kept only when the oracle holds the capitalised form and not the lower-case one; no expected value comes
// from the product.
//
// Test argument
// ROW-141 promise: correct dictionary words written in all capitals with capital accents (GESTIÓN), or in
//   title case (Gestión), are not flagged, over a generated sample (REQ-001 fail-if arm 2: a correctly
//   spelled dictionary word is flagged; REQ-003: capital words longer than 5 letters are checked like any
//   other word, accents included; REQ-009: a title-case word mid-sentence that is a dictionary word is no
//   name question at all).
// ROW-141 wrong product: a checker that looks capitals up as written in a lower-case dictionary (so every
//   GESTIÓN is "unknown"), one that lower-cases with a locale-blind table that drops or mangles Á É Í Ó Ú Ñ
//   Ü, or one that strips capital accents first (GESTIÓN → GESTION) and then flags its own result.
// ROW-141 given: a fresh draw of several hundred accented dictionary words of 7+ letters (the accent
//   population), each written either in capitals (GESTIÓN-like) or in title case (Gestión-like), mostly
//   mid-sentence, filling one text under the length limit; plus five near misses that must be flagged —
//   three accent-stripped words in capitals (GESTION-like) and two in title case mid-sentence
//   (Gestion-like, A-036); when: the text is sent to POST /api/check; then: the flags are exactly the five
//   near misses at their offsets.
// ROW-141 controls: the control case (a fresh non-word flagged); the near misses in the same text show the
//   capital path is reached and does flag.
// ROW-141 technique: a property over a generated sample (fresh order and words every run), the same
//   capital and title transforms applied to correct and stripped words so only the dictionary decides.
// cases: ROW-141 target=ROW-141-correct-words-in-capitals-or-title-case-are-not-flagged-over-a-generated-sample control=ROW-141-ROW-145-control-a-fresh-non-word-is-flagged-at-its-offsets
//
// ROW-145 promise: dictionary entries that exist only capitalised (España, Bogotá), written in lower case,
//   are flagged with the capitalised form first (REQ-001: the dictionary is the authority; the entry is
//   "España", so "españa" is not a word it holds).
// ROW-145 wrong product: a checker that lower-cases every word and every entry before comparing (so
//   "españa" passes), or whose suggestions offer a lower-case or unrelated word before "España".
// ROW-145 given: españa (the row's example) and four fresh draws from a hand list of place names whose
//   capitalised form the oracle holds and whose lower-case form it does not (México, Perú, Madrid,
//   Colombia, Chile, Venezuela, Europa, América, Sevilla …), each in lower case mid-sentence, beside two of
//   the capitalised forms as near misses; plus bogotá, flagged because the dictionary holds neither form;
//   when: the text is sent to POST /api/check; then: the flags are exactly the lower-case forms at their
//   offsets, and each oracle-held entry's first suggestion is exactly its capitalised form.
//   Bogotá, the row's second example, is not an entry of dictionary-es 4.0.0 (the oracle holds neither
//   Bogotá nor bogotá), so only its flag is asserted, not a first suggestion the dictionary cannot give.
// ROW-145 controls: the shared control case; the capitalised forms in the same text (not flagged).
// ROW-145 technique: the row's named example plus fresh oracle-confirmed entries, the expected suggestion
//   being the dictionary's own entry.
// cases: ROW-145 target=ROW-145-capitalised-only-entries-written-in-lower-case-are-flagged-with-the-capitalised-form-first control=ROW-141-ROW-145-control-a-fresh-non-word-is-flagged-at-its-offsets

import { expect, test } from '@playwright/test';
import { accentPopulation, asActor, checkText, freshNonWord, freshRandom, hasInclusiveReading, isDictionaryWord } from './harness';
import { firstSuggestionAt, flagDiff, layout, titleEs, upperEs, type Item } from './words-helpers';

const MAX_TEXT = 9_000; // under REQ-021's 10,000-character limit

test('ROW-141-correct-words-in-capitals-or-title-case-are-not-flagged-over-a-generated-sample', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const pool = rng.shuffle(accentPopulation());
  const misses = pool.slice(0, 5).map((p, i) => (i < 3 ? upperEs(p.stripped) : titleEs(p.stripped)));
  for (const w of misses) if (isDictionaryWord(w)) throw new Error(`setup: the oracle holds ${w}`);
  const sample: string[] = [];
  for (const p of pool.slice(5, 5 + 900)) {
    const w = rng.int(2) === 0 ? upperEs(p.word) : titleEs(p.word);
    if (!isDictionaryWord(w)) throw new Error(`setup: the oracle does not hold ${w}`);
    sample.push(w);
  }
  // as many sample words as fit in one text under the limit (fillers between them included)
  let built = layout(rng, [], {});
  for (let n = sample.length; n > 0; n -= 20) {
    const kept = sample.slice(0, n);
    const items: Item[] = rng.shuffle([...kept, ...misses]).map((word) => ({ word, initial: !misses.includes(word) && rng.int(10) === 0 }));
    built = layout(rng, items, { min: 0, max: 1 });
    if (built.text.length <= MAX_TEXT) {
      sample.length = n;
      break;
    }
  }
  const { text, items: placed } = built;
  expect(sample.length, 'ROW-141 setup: a sample of several hundred words, never a handful').toBeGreaterThan(300);
  const expected = placed.filter((p) => misses.includes(p.word));
  expect(expected.length, 'ROW-141 setup: each near miss stands once').toBe(5);
  expect(text.length, 'ROW-141 setup: the text is under the length limit').toBeLessThan(10_000);

  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, expected),
    `ROW-141: over ${sample.length} correct words in capitals or title case (seed ${rng.seed}) none is flagged; only ${misses.join(', ')} are`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

const PLACES = [
  'México', 'Perú', 'Madrid', 'Barcelona', 'Colombia', 'Chile', 'Venezuela', 'Guatemala', 'Uruguay', 'Bolivia',
  'Europa', 'América', 'Sevilla', 'Cartagena', 'Zaragoza', 'Bilbao',
];

const capitalisedOnly = (w: string) => isDictionaryWord(w) && !isDictionaryWord(w.toLocaleLowerCase('es')) && !hasInclusiveReading(w.toLocaleLowerCase('es'));

test('ROW-145-capitalised-only-entries-written-in-lower-case-are-flagged-with-the-capitalised-form-first', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  if (!capitalisedOnly('España')) throw new Error('setup: the oracle does not hold España as a capitalised-only entry');
  if (isDictionaryWord('Bogotá') || isDictionaryWord('bogotá')) throw new Error('setup: the oracle now holds Bogotá — assert its first suggestion too');
  const drawn = rng.shuffle(PLACES.filter(capitalisedOnly)).slice(0, 4);
  expect(drawn.length, 'ROW-145 setup: four oracle-confirmed capitalised-only entries').toBe(4);
  const entries = ['España', ...drawn];
  const lowerToEntry = new Map(entries.map((e) => [e.toLocaleLowerCase('es'), e]));
  const decoys = rng.shuffle(entries).slice(0, 2);
  const items: Item[] = rng.shuffle([...lowerToEntry.keys(), 'bogotá', ...decoys]).map((word) => ({ word }));
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => lowerToEntry.has(p.word) || p.word === 'bogotá');
  expect(expected.length, 'ROW-145 setup: every lower-case form stands once').toBe(entries.length + 1);

  const answer = await checkText(text);
  const withEntry = expected.filter((p) => lowerToEntry.has(p.word));
  expect(
    {
      flags: flagDiff(text, answer, expected),
      firstSuggestions: withEntry.map((p) => `${p.word} → ${firstSuggestionAt(answer, p)}`),
    },
    `ROW-145: in ${JSON.stringify(text)} ${[...lowerToEntry.keys()].join(', ')} and bogotá are flagged, each entry's capitalised form first; ${decoys.join(', ')} are not flagged (seed ${rng.seed})`,
  ).toEqual({
    flags: { notFlagged: [], flaggedWrongly: [] },
    firstSuggestions: withEntry.map((p) => `${p.word} → ${lowerToEntry.get(p.word)}`),
  });
});

test('ROW-141-ROW-145-control-a-fresh-non-word-is-flagged-at-its-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, items),
    `ROW-141/ROW-145 control: the endpoint flags exactly the fresh non-word "${nonWord}" where it stands in ${JSON.stringify(text)}`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});
