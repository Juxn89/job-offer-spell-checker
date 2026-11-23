// Purpose: ROW-007 and ROW-008 (REQ-004) — through the check endpoint, the ten job and tech terms REQ-004
// names, correctly written, are never flagged, while a misspelling of a term-list word (Javscript,
// fronted, and fresh one-letter slips of the others) is flagged.
// Provenance: hand-authored from REQ-004's fail-if (the ten terms) and ROW-008's examples (Javscript,
// fronted); further misspellings are generated per run by deleting one inner letter of a term, kept only
// when dictionary-es 4.0.0 (the harness oracle, pinned) holds no such word; no expected value comes from
// the product.
//
// Test argument
// ROW-007 promise: JavaScript, Python, Excel, backend, frontend, freelance, home office, marketing,
//   software and Scrum, correctly written, are not flagged (REQ-004 fail-if; A-007 "a short built-in list
//   of common job and tech terms is treated as correct").
// ROW-007 wrong product: a term list matched case-insensitively against lower-cased input but stored in
//   another case (so "JavaScript" misses), a list that holds "home" and "office" only as one token (so
//   "office" is flagged in "home office"), or no list at all (every non-dictionary term flagged).
// ROW-007 given: the ten terms in a fresh order between correct filler words, some opening a sentence,
//   plus one fresh non-word; when: the text is sent to POST /api/check; then: the flags are exactly the
//   fresh non-word at its offsets — no term, and no part of "home office", flagged.
// ROW-007 controls: the fresh non-word flagged in the same text shows the checker flags; the control case
//   shows it alone.
// ROW-007 technique: the row's own complete list (every one of the ten, every run) with a near-miss
//   non-word in the same text, so a checker that flags nothing cannot pass.
// cases: ROW-007 target=ROW-007-the-ten-named-terms-correctly-written-are-not-flagged control=ROW-007-ROW-008-control-a-fresh-non-word-is-flagged-at-its-offsets
//
// ROW-008 promise: a misspelling of a term-list word (Javscript, fronted) is flagged (ROW-008 is ROW-007's
//   control: the list holds the terms, not their neighbourhood; REQ-001: a word the dictionary does not
//   hold is flagged). A capitalised misspelling is placed first in its sentence, where REQ-009 checks it
//   (a capitalised unknown word mid-sentence is taken as a name).
// ROW-008 wrong product: a term list matched fuzzily or by prefix ("Javscript" ≈ "JavaScript", "fronted"
//   a prefix of "frontend"), or a list that exempts any word containing a listed stem.
// ROW-008 given: Javscript (sentence-initial) and fronted (mid-sentence), plus one fresh misspelling of
//   each other single-word term made by deleting one inner letter (capitalised terms sentence-initial),
//   beside the correct terms themselves as near misses; when: the text is sent to POST /api/check; then:
//   the flags are exactly the misspellings, each at its offsets.
// ROW-008 controls: the correct terms in the same text (not flagged) and the control case.
// ROW-008 technique: the row's named examples plus generated one-letter slips, each confirmed absent
//   from the dictionary by the oracle.
// cases: ROW-008 target=ROW-008-misspellings-of-term-list-words-are-flagged control=ROW-007-ROW-008-control-a-fresh-non-word-is-flagged-at-its-offsets

import { expect, test } from '@playwright/test';
import { asActor, checkText, freshNonWord, freshRandom, hasInclusiveReading, isDictionaryWord, type Rng } from './harness';
import { flagDiff, layout, type Item } from './words-helpers';

const TERMS = ['JavaScript', 'Python', 'Excel', 'backend', 'frontend', 'freelance', 'home office', 'marketing', 'software', 'Scrum'];
const capitalised = (w: string) => /^\p{Lu}/u.test(w);

function slip(rng: Rng, term: string): string | null {
  const positions = rng.shuffle(Array.from({ length: term.length - 2 }, (_, i) => i + 1));
  for (const i of positions) {
    const w = term.slice(0, i) + term.slice(i + 1);
    const lower = w.toLowerCase();
    if (TERMS.some((t) => t.toLowerCase() === lower)) continue;
    if (isDictionaryWord(w) || isDictionaryWord(lower) || hasInclusiveReading(lower)) continue;
    return w;
  }
  return null;
}

test('ROW-007-the-ten-named-terms-correctly-written-are-not-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const items: Item[] = rng.shuffle([...TERMS, nonWord]).map((word) => ({ word, initial: word !== nonWord && rng.int(4) === 0 }));
  const { text, items: placed } = layout(rng, items);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, placed.filter((p) => p.word === nonWord)),
    `ROW-007: in ${JSON.stringify(text)} none of ${TERMS.join(', ')} is flagged, and the fresh "${nonWord}" is (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

test('ROW-008-misspellings-of-term-list-words-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const named = ['Javscript', 'fronted'];
  for (const w of named) if (isDictionaryWord(w) || isDictionaryWord(w.toLowerCase())) throw new Error(`setup: the dictionary oracle holds ${w}`);
  const generated: string[] = [];
  for (const term of TERMS) {
    if (term.includes(' ') || term === 'JavaScript' || term === 'frontend') continue; // the named examples cover those two
    const w = slip(rng, term);
    if (w) generated.push(w);
  }
  expect(generated.length, 'ROW-008 setup: a slip for most single-word terms').toBeGreaterThanOrEqual(5);
  const misspelled = [...named, ...generated];
  const items: Item[] = rng
    .shuffle([...misspelled, ...TERMS.filter((t) => !t.includes(' '))])
    .map((word) => ({ word, initial: capitalised(word) }));
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => misspelled.includes(p.word));
  expect(expected.length, 'ROW-008 setup: every misspelling stands once').toBe(misspelled.length);

  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, expected),
    `ROW-008: in ${JSON.stringify(text)} exactly ${misspelled.join(', ')} are flagged — the correct terms are not (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

test('ROW-007-ROW-008-control-a-fresh-non-word-is-flagged-at-its-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, items),
    `ROW-007/ROW-008 control: the endpoint flags exactly the fresh non-word "${nonWord}" where it stands in ${JSON.stringify(text)}`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});
