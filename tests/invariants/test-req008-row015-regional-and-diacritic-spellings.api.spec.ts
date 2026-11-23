// Purpose: ROW-015 (REQ-008) — through the check endpoint, computadora, ordenador, celular, móvil, tenés,
// sólo and éste are not flagged, and guión is flagged.
// Provenance: hand-authored from REQ-008's fail-if examples and A-012; fillers from the harness; no
// expected value comes from the product.
//
// Test argument
// ROW-015 promise: Spain and Latin American spellings and voseo (computadora, ordenador, celular,
//   móvil, tenés) are accepted, the diacritic accents the RAE advises against but does not call errors
//   (sólo, éste) are accepted, and guión, an error under the current rules, is flagged (REQ-008 fail-if,
//   every arm; A-012 "guión is flagged, guion is correct").
// ROW-015 wrong product: the bare vendored dictionary, which does not hold the voseo "tenés" and so
//   flags it; a dictionary edition that still holds "guión", so it goes unflagged; a checker that
//   "modernises" by flagging sólo/éste; or one that accepts the named words only in lower case and
//   flags "Tenés" or "Sólo" where a sentence opens.
// ROW-015 given: each named word mid-sentence and title-cased where a sentence opens, in a fresh order,
//   beside the near misses guion, solo and este (correct and unflagged); when: POST /api/check; then:
//   exactly the two guión/Guión are flagged, at their offsets.
// ROW-015 controls: guión standing alone in plain filler text is flagged at its offsets — the path to a
//   flag is reached, so the accepted words' silence is acceptance.
// ROW-015 technique: the row's own example values, every one, in both casings, fresh positions each
//   run; exact comparison with decoys one accent apart (guion/guión, solo/sólo, este/éste).
// cases: ROW-015 target=ROW-015-regional-voseo-and-diacritic-words-accepted-and-guion-with-accent-flagged control=ROW-015-control-guion-with-accent-alone-is-flagged

import { test } from '@playwright/test';
import { asActor, freshRandom } from './harness';
import { Offer, expectExact, fillers, titleCase } from './names-terms-helpers';

const ACCEPTED = ['computadora', 'ordenador', 'celular', 'móvil', 'tenés', 'sólo', 'éste', 'guion', 'solo', 'este'];

test('ROW-015-regional-voseo-and-diacritic-words-accepted-and-guion-with-accent-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  type Item = { word: string; flagged: boolean };
  const items: Item[] = [
    ...ACCEPTED.map((w) => ({ word: w, flagged: false })),
    ...ACCEPTED.map((w) => ({ word: titleCase(w), flagged: false })),
    { word: 'guión', flagged: true },
    { word: 'Guión', flagged: true },
  ];
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (const it of rng.shuffle(items)) {
    const opening = it.word[0] !== it.word[0].toLowerCase();
    o.put(opening ? '. ' : ' ' + fillers(rng, 1 + rng.int(2)) + ' ');
    if (it.flagged) o.flag(it.word, `${it.word} (an error under the current rules)`);
    else o.keep(it.word, `${it.word} (accepted)`);
    o.put(' ' + fillers(rng, 2));
  }
  o.put('.');
  await expectExact(o, `ROW-015: computadora, ordenador, celular, móvil, tenés, sólo and éste (and guion, solo, este) are not flagged, and guión is, in both casings (seed ${rng.seed})`);
});

test('ROW-015-control-guion-with-accent-alone-is-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 3, { capital: true }) + ' ').flag('guión', 'guión alone').put(' ' + fillers(rng, 3) + '.');
  await expectExact(o, `ROW-015 control: guión in plain filler text is flagged at its offsets (seed ${rng.seed})`);
});
