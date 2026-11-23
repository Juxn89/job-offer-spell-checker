// Purpose: ROW-009 (REQ-005) — through the check endpoint, a correct word next to ¿, ¡, a comma, a
// bracket or a quote is not flagged, and no flag (so no highlight) ever covers a punctuation mark.
// Provenance: hand-authored from REQ-005's fail-if and A-017; correct words from the harness fillers
// and the dictionary oracle's accent population, misspellings fresh per run (freshNonWord); no expected
// value comes from the product.
//
// Test argument
// ROW-009 promise: a correct word beside ¿ ¡ , ; : . … brackets or quotes is not flagged and no
//   punctuation mark is flagged or highlighted (REQ-005 fail-if arms 1 and 2; A-017 "¿ ¡ and all
//   other punctuation separate words and are never flagged"); a flag's span is what the page
//   highlights (D-020: word = text.slice(start, end)).
// ROW-009 wrong product: a splitter on white space alone that looks up "¿equipo?" or "(gestión)"
//   whole and flags it; or one that strips the marks for the lookup but reports the white-space
//   token's span, so the flag — and the highlight drawn from it — covers "«zqrtvb»" with its marks.
// ROW-009 given: correct dictionary words and fresh non-words, each wrapped in or glued to every mark
//   the row names (¿…? ¡…! , ; : . … ... ( ) [ ] { } « » " " “ ” ' ' ‘ ’), plus free-standing
//   punctuation clusters; when: POST /api/check; then: the flags are exactly the non-words, each
//   spanning its letters only — no correct word, no mark, no cluster flagged.
// ROW-009 controls: the same kind of fresh non-words between plain spaces are flagged at their offsets
//   (the endpoint flags, so silence on the correct words is not an empty answer); in the target the
//   wrapped non-words are the required other half of the same exact comparison.
// ROW-009 technique: a property over every mark the row names, on both sides of a word and glued
//   without spaces, fresh words, order and positions each run; exact list comparison with decoys
//   (a non-word inside the same marks must be flagged, letters only).
// cases: ROW-009 target=ROW-009-correct-words-beside-punctuation-not-flagged-and-flags-cover-letters-only control=ROW-009-control-fresh-non-words-between-spaces-flagged-at-their-offsets

import { test } from '@playwright/test';
import { accentPopulation, asActor, fillerWords, freshNonWord, freshRandom } from './harness';
import { Offer, expectExact, fillers } from './names-terms-helpers';

// Every mark REQ-005/A-017 names, as [before, after] a word.
const WRAPS: [string, string][] = [
  ['¿', '?'], ['¡', '!'], ['', ','], ['', ';'], ['', ':'], ['', '.'], ['', '…'], ['', '...'],
  ['(', ')'], ['[', ']'], ['{', '}'], ['«', '»'], ['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’'],
  ['¿(', ')?'], ['(«', '»)'], ['¡“', '”!'],
];
// Marks that join two words with no space between them.
const GLUES = [',', ';', ')(', '»«', '”“', '?¿', '!¡'];
// Punctuation standing alone: nothing in them may be flagged.
const CLUSTERS = ['¿?', '¡!', '...', '…', '()', '«»', '“”', '?!', ';', ',', '—', '[]'];

test('ROW-009-correct-words-beside-punctuation-not-flagged-and-flags-cover-letters-only', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const pool = [...fillerWords().filter((w) => w.length >= 3), ...rng.shuffle(accentPopulation()).slice(0, 40).map((p) => p.word)];
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ');

  for (const [before, after] of rng.shuffle(WRAPS)) {
    // a correct word inside the marks, then a non-word inside the same marks
    o.put(before).keep(rng.pick(pool), `correct word inside ${before}…${after}`).put(after + ' ');
    o.put(fillers(rng, 1) + ' ');
    o.put(before).flag(freshNonWord(rng), `non-word inside ${before}…${after}`).put(after + ' ');
  }
  for (const glue of rng.shuffle(GLUES)) {
    // glued with no space: correct|non-word and non-word|correct
    o.keep(rng.pick(pool), `correct word glued by ${glue}`).put(glue).flag(freshNonWord(rng), `non-word glued by ${glue}`).put(' ');
    o.flag(freshNonWord(rng), `non-word glued by ${glue}`).put(glue).keep(rng.pick(pool), `correct word glued by ${glue}`).put(' ');
  }
  for (const c of rng.shuffle(CLUSTERS)) o.put(fillers(rng, 1) + ' ').keep(c, 'punctuation standing alone').put(' ');
  o.put(fillers(rng, 2));

  await expectExact(o, `ROW-009: beside ¿ ¡ , ; : . … brackets and quotes (seed ${rng.seed}), only the fresh non-words are flagged, each over its letters alone, and no correct word or mark is flagged`);
});

test('ROW-009-control-fresh-non-words-between-spaces-flagged-at-their-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (let i = 0; i < 4; i++) o.put(' ' + fillers(rng, 1 + rng.int(2)) + ' ').flag(freshNonWord(rng), 'non-word between spaces');
  o.put(' ' + fillers(rng, 2));
  await expectExact(o, `ROW-009 control: fresh non-words between plain spaces are flagged at their offsets (seed ${rng.seed})`);
});
