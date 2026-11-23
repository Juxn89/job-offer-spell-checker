// Purpose: ROW-019 (REQ-035) — through the check endpoint, a correct name after Lic., Sr. or Dr. is not
// flagged — the abbreviation's period does not open a sentence — while the same name after an ordinary
// full stop is flagged.
// Provenance: hand-authored from REQ-035's fail-if example and A-031; surnames typed from general
// knowledge (checked absent from the dictionary oracle) and fresh names per run (freshName); no
// expected value comes from the product.
//
// Test argument
// ROW-019 promise: a correct name after Lic., Sr. or Dr. is not flagged (REQ-035 fail-if arm 2; A-031
//   "a word after an accepted abbreviation such as Lic., Sr. or Dr. is not a sentence start").
// ROW-019 wrong product: a sentence splitter that ends a sentence at every ". ", so the name after
//   "Dr." is taken as a sentence opening, checked, and flagged; or one that handles the abbreviation
//   only mid-sentence and fails when "Lic. Quispe" opens a line or the text.
// ROW-019 given: Lic., Sr. and Dr. (and Sra., Dra., Ing.) each followed by a name the dictionary does
//   not hold — Quispe, Mamani, Huamán, fresh names — with the abbreviation itself opening the text, a
//   sentence, a line, after a colon, or mid-sentence; near misses in the same text: fresh names after an
//   ordinary word's full stop (a real sentence opening); when: POST /api/check; then: exactly the near
//   misses are flagged — no name after an abbreviation.
// ROW-019 controls: fresh names opening sentences after ordinary full stops are flagged — the very
//   check the abbreviation must switch off is live.
// ROW-019 technique: the row's three abbreviations (and the other titles A-017 accepts) in every
//   position, real and fresh names; exact comparison with the same names after a real full stop as
//   decoys.
// cases: ROW-019 target=ROW-019-a-correct-name-after-lic-sr-or-dr-not-flagged control=ROW-019-control-fresh-names-after-an-ordinary-full-stop-flagged

import { test } from '@playwright/test';
import { asActor, freshRandom } from './harness';
import { Offer, expectExact, fillers, freshName, requireNotDictionary } from './names-terms-helpers';

const NAMED = ['Lic.', 'Sr.', 'Dr.'];
const OTHERS = ['Sra.', 'Dra.', 'Ing.'];
const SURNAMES = ['Quispe', 'Mamani', 'Huamán', 'Condori', 'Ccama'];
const OPENINGS = ['. ', '\n', '\n• ', ': ', ' '];

test('ROW-019-a-correct-name-after-lic-sr-or-dr-not-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireNotDictionary(SURNAMES, 'ROW-019 surnames (names the dictionary does not hold)');
  const o = new Offer().keep(rng.pick(NAMED), 'abbreviation opening the text').put(' ').keep(rng.pick(SURNAMES), 'name after an abbreviation opening the text').put(' ' + fillers(rng, 3));
  const titles = [...NAMED, ...NAMED, ...OTHERS];
  for (const opening of OPENINGS) {
    for (const t of rng.shuffle(titles)) {
      const name = rng.int(2) === 0 ? rng.pick(SURNAMES) : freshName(rng);
      o.put(' ' + fillers(rng, 2) + opening).keep(t, `${t}`).put(' ').keep(name, `name after ${t} (abbreviation after ${JSON.stringify(opening)})`).put(' ' + fillers(rng, 2));
    }
    // the near miss: a fresh name after an ordinary full stop
    o.put(' ' + fillers(rng, 2) + '. ').flag(freshName(rng), 'fresh name after an ordinary full stop').put(' ' + fillers(rng, 2));
  }
  o.put('.');
  await expectExact(o, `ROW-019: names after Lic., Sr. and Dr. (and Sra., Dra., Ing.) are not flagged in any position, while a fresh name after an ordinary full stop is (seed ${rng.seed})`);
});

test('ROW-019-control-fresh-names-after-an-ordinary-full-stop-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 3, { capital: true }));
  for (let i = 0; i < 4; i++) o.put('. ').flag(freshName(rng), 'fresh name after an ordinary full stop').put(' ' + fillers(rng, 3));
  o.put('.');
  await expectExact(o, `ROW-019 control: fresh names opening sentences after ordinary full stops are flagged (seed ${rng.seed})`);
});
