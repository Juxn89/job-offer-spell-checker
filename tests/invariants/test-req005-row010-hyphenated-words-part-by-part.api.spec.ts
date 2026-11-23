// Purpose: ROW-010 (REQ-005) — through the check endpoint, a hyphenated word whose parts are all correct
// is not flagged, and one with a misspelled part is flagged at that part, and only there.
// Provenance: hand-authored from REQ-005 and A-017 ("a hyphenated word is checked part by part"); parts
// drawn from the dictionary oracle's accent population (correct form and accent-stripped form) and the
// harness fillers, fresh non-words per run; no expected value comes from the product.
//
// Test argument
// ROW-010 promise: a hyphenated word whose parts are all correct is not flagged; one with a misspelled
//   part is flagged at that part (REQ-005 "a hyphenated word is checked part by part", fail-if arm 3;
//   A-017).
// ROW-010 wrong product: one that looks the whole "teórico-práctico" up and flags it (no dictionary
//   holds compounds); or one that, finding a bad part, flags the whole hyphenated word — the
//   highlight then covers the correct part and the hyphen too; or one that checks only the first part.
// ROW-010 given: two- and three-part hyphenated words in four kinds — all parts correct (with the
//   named example teórico-práctico), the last part missing its accent, the first part missing its
//   accent, a fresh non-word as the middle part; when: POST /api/check; then: exactly the misspelled
//   parts are flagged, each at its own offsets, and nothing else (no correct part, no hyphen).
// ROW-010 controls: the same misspelled parts standing alone between spaces are flagged at their
//   offsets — they are misspellings to the product, so the target's verdict is about the hyphen.
// ROW-010 technique: a property over generated compounds (fresh pairs from the dictionary each run),
//   plus the named example and its near miss teórico-practico; exact comparison, so a whole-word flag
//   or a flag on a correct part fails by name.
// cases: ROW-010 target=ROW-010-hyphenated-words-checked-part-by-part-and-flagged-only-at-the-misspelled-part control=ROW-010-control-the-misspelled-parts-alone-are-flagged

import { test } from '@playwright/test';
import { accentPopulation, asActor, fillerWords, freshNonWord, freshRandom, type Rng } from './harness';
import { Offer, expectExact, fillers, requireDictionary, requireNotDictionary } from './names-terms-helpers';

function parts(rng: Rng) {
  const pairs = rng.shuffle(accentPopulation()).slice(0, 60);
  const correct = [...pairs.slice(0, 30).map((p) => p.word), ...fillerWords().filter((w) => w.length >= 5)];
  return { pairs: pairs.slice(30), correct };
}

test('ROW-010-hyphenated-words-checked-part-by-part-and-flagged-only-at-the-misspelled-part', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireDictionary(['teórico', 'práctico'], 'ROW-010 named example');
  requireNotDictionary(['practico'], 'ROW-010 near miss');
  const { pairs, correct } = parts(rng);
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ');
  const kinds = rng.shuffle([
    ...Array.from({ length: 12 }, () => 'all-correct'),
    ...Array.from({ length: 8 }, () => 'last-misspelled'),
    ...Array.from({ length: 8 }, () => 'first-misspelled'),
    ...Array.from({ length: 4 }, () => 'middle-non-word'),
    'named',
    'named-near-miss',
  ]);
  let p = 0;
  for (const kind of kinds) {
    o.put(fillers(rng, 1 + rng.int(2)) + ' ');
    if (kind === 'named') o.keep('teórico-práctico', 'named example teórico-práctico');
    else if (kind === 'named-near-miss') o.keep('teórico', 'correct first part of teórico-practico').put('-').flag('practico', 'misspelled part of teórico-practico');
    else if (kind === 'all-correct') o.keep(`${rng.pick(correct)}-${rng.pick(correct)}`, 'hyphenated word with all parts correct');
    else if (kind === 'last-misspelled') {
      const bad = pairs[p++ % pairs.length].stripped;
      o.keep(rng.pick(correct), 'correct first part').put('-').flag(bad, 'misspelled last part');
    } else if (kind === 'first-misspelled') {
      const bad = pairs[p++ % pairs.length].stripped;
      o.flag(bad, 'misspelled first part').put('-').keep(rng.pick(correct), 'correct last part');
    } else {
      o.keep(rng.pick(correct), 'correct first part').put('-').flag(freshNonWord(rng), 'non-word middle part').put('-').keep(rng.pick(correct), 'correct last part');
    }
    o.put(rng.int(3) === 0 ? ', ' : ' ');
  }
  o.put(fillers(rng, 2));
  await expectExact(o, `ROW-010: hyphenated words are checked part by part (seed ${rng.seed}) — all-correct compounds unflagged, each misspelled part flagged at its own offsets and nothing around it`);
});

test('ROW-010-control-the-misspelled-parts-alone-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { pairs } = parts(rng);
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ').flag('practico', 'practico alone');
  for (const pair of pairs.slice(0, 5)) o.put(' ' + fillers(rng, 1) + ' ').flag(pair.stripped, 'accent-stripped part alone');
  o.put(' ' + fillers(rng, 1) + ' ').flag(freshNonWord(rng), 'non-word alone').put(' ' + fillers(rng, 2));
  await expectExact(o, `ROW-010 control: the kinds of part the target hyphenates are flagged at their offsets when they stand alone (seed ${rng.seed})`);
});
