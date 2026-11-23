// Purpose: ROW-014 (REQ-007) — through the check endpoint, Lic., Ing., Sr., Sra., Dr., Dra. and etc. are
// not flagged wherever they stand — opening the text, a sentence or a line, after a colon, mid-sentence —
// while a misspelling ending in a period is still flagged.
// Provenance: hand-authored from REQ-007's fail-if list and A-017; misspellings fresh per run
// (freshNonWord); no expected value comes from the product.
//
// Test argument
// ROW-014 promise: Lic., Ing., Sr., Sra., Dr., Dra. and etc. are not flagged (REQ-007 fail-if arm 2;
//   A-017 "common abbreviations ending in a period ... are accepted").
// ROW-014 wrong product: one that keeps the period in the word and looks up "Lic." (no dictionary
//   holds the period), flagging every title; one that accepts them only mid-sentence, flagging "Ing."
//   or "Dra." where a sentence or line opens; or one that exempts every word followed by a period, so
//   a real misspelling at a sentence end goes unflagged.
// ROW-014 given: each of the seven abbreviations in every position a sentence can give it (text start,
//   after ". ", "? ", at a line start, a bullet, after a colon, mid-sentence; etc. closing a list and
//   a line), each run in a fresh order; plus fresh non-words followed by a period mid-sentence and at
//   a sentence end; when: POST /api/check; then: the flags are exactly the non-words, each without
//   its period — no abbreviation flagged.
// ROW-014 controls: fresh non-words with a period set in the very positions the abbreviations take
//   are flagged there — those positions are checked, so the abbreviations' silence is acceptance.
// ROW-014 technique: the row's whole list in every position, fresh order each run; the near miss
//   (a non-word + ".") sits in the same text; exact comparison.
// cases: ROW-014 target=ROW-014-lic-ing-sr-sra-dr-dra-and-etc-not-flagged-in-any-position control=ROW-014-control-non-words-with-a-period-in-the-same-positions-are-flagged

import { test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom, type Rng } from './harness';
import { Offer, expectExact, fillers } from './names-terms-helpers';

const TITLES = ['Lic.', 'Ing.', 'Sr.', 'Sra.', 'Dr.', 'Dra.'];

/** Where a title stands: the text before it (the opening) and the words after it. */
const POSITIONS: { before: string; label: string }[] = [
  { before: '', label: 'opening the text' },
  { before: '. ', label: 'after a full stop' },
  { before: '? ', label: 'after a question mark' },
  { before: '\n', label: 'at a line start' },
  { before: '\n• ', label: 'after a bullet' },
  { before: ': ', label: 'after a colon' },
  { before: ' ', label: 'mid-sentence' },
];

/** One word opens the text; then every word in every other position, in a fresh order per position. */
function place(o: Offer, rng: Rng, words: string[], put: (o: Offer, w: string, label: string) => void): void {
  put(o, rng.pick(words), POSITIONS[0].label);
  o.put(' ' + fillers(rng, 2));
  for (const pos of POSITIONS.slice(1)) {
    for (const w of rng.shuffle(words)) {
      o.put(' ' + fillers(rng, 2 + rng.int(2)) + pos.before);
      put(o, w, pos.label);
      o.put(' ' + fillers(rng, 2));
    }
  }
}

test('ROW-014-lic-ing-sr-sra-dr-dra-and-etc-not-flagged-in-any-position', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer();
  place(o, rng, TITLES, (x, w, label) => x.keep(w, `${w} ${label}`));
  // etc. closing a list mid-sentence, and closing a line
  o.put(', ' + fillers(rng, 1) + ', ' + fillers(rng, 1) + ' ').keep('etc.', 'etc. closing a list').put(' ' + fillers(rng, 2));
  o.put(', ' + fillers(rng, 1) + ' ').keep('etc.', 'etc. closing a line').put('\n' + fillers(rng, 2, { capital: true }));
  // the near misses: a misspelling followed by a period, mid-sentence and at a sentence end
  o.put(' ').flag(freshNonWord(rng), 'non-word followed by a period mid-sentence').put('. ' + fillers(rng, 2));
  o.put(' ').flag(freshNonWord(rng), 'non-word ending a sentence').put('.\n' + fillers(rng, 2, { capital: true }) + '.');
  await expectExact(o, `ROW-014: Lic., Ing., Sr., Sra., Dr., Dra. and etc. are not flagged in any position, while a misspelling before a period is (seed ${rng.seed})`);
});

test('ROW-014-control-non-words-with-a-period-in-the-same-positions-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer();
  place(o, rng, [freshNonWord(rng), freshNonWord(rng)], (x, w, label) => x.flag(w, `non-word ${label}`).put('.'));
  await expectExact(o, `ROW-014 control: fresh non-words with a period, in the positions the titles take, are flagged without the period (seed ${rng.seed})`);
});
