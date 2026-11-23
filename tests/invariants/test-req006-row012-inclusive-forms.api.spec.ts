// Purpose: ROW-012 (REQ-006) — through the check endpoint, inclusive forms on a correct base (candidato/a,
// todos/as, l@s, tod@s, todxs, todes) are not flagged, and an inclusive form on a misspelled base
// (canditado/a) is flagged.
// Provenance: hand-authored from REQ-006's fail-if examples and A-017; further bases from a hand-written
// list of job-offer words whose masculine and feminine forms the dictionary oracle holds (checked on
// use), misspelled bases made fresh per run (adjacent-letter swaps and fresh non-words, checked against
// the oracle); no expected value comes from the product.
//
// Test argument
// ROW-012 promise: candidato/a, todos/as, l@s, tod@s, todxs and todes are not flagged, and an
//   inclusive form on a misspelled base (canditado/a) is flagged (REQ-006 fail-if, both arms; A-017).
// ROW-012 wrong product: one that splits "candidato/a" at the slash and flags the lone "a"-less
//   fragment, or looks up "todxs" / "tod@s" / "todes" as written and flags them; or the opposite, a
//   blanket pass for any token with a slash, @, x or e ending, so "canditado/a" goes unflagged.
// ROW-012 given: the six named forms, the same eight shapes (o/a, os/as, @, @s, x, xs, e, es) over
//   other correct bases, and the same shapes over misspelled bases (canditado/a named, plus fresh
//   swaps and non-words); when: POST /api/check; then: no correct-base form is flagged, and each
//   misspelled-base form is flagged once, from its first letter — to the end of the form or to the
//   end of its base before the / or @ (the row fixes that it is flagged, not which of the two spans).
// ROW-012 controls: the misspelled bases standing alone (canditado, the swaps) are flagged at their
//   offsets — they are misspellings to the product, so the target's verdict is about the endings.
// ROW-012 technique: the row's named examples every run, plus a property over the eight ending shapes
//   on fresh bases, correct and misspelled side by side (decoys one letter-swap apart); exact
//   comparison.
// cases: ROW-012 target=ROW-012-inclusive-forms-on-correct-bases-not-flagged-and-on-misspelled-bases-flagged control=ROW-012-control-the-misspelled-bases-alone-are-flagged

import { test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom, isDictionaryWord, type Rng } from './harness';
import { Offer, expectExact, fillers, requireDictionary, requireNotDictionary, titleCase } from './names-terms-helpers';

// Bases in -o whose -a, -os and -as forms are words (no -co/-go, whose e-forms change spelling).
const BASES = ['candidato', 'interesado', 'licenciado', 'ingeniero', 'empleado', 'encargado', 'abogado', 'nuevo', 'seleccionado', 'contratado', 'motivado', 'comprometido', 'alumno', 'compañero', 'todo'];

/** The eight inclusive shapes REQ-006 names, over a base in -o; `cut` is where the base ends before / or @. */
function shapes(base: string): { form: string; cut?: number }[] {
  const stem = base.slice(0, -1);
  return [
    { form: `${base}/a`, cut: base.length },
    { form: `${base}s/as`, cut: base.length + 1 },
    { form: `${stem}@`, cut: stem.length },
    { form: `${stem}@s`, cut: stem.length },
    { form: `${stem}x` },
    { form: `${stem}xs` },
    { form: `${stem}e` },
    { form: `${stem}es` },
  ];
}

/** A misspelled base in -o: two adjacent letters of a real base swapped, or a fresh non-word + o. */
function misspelledBase(rng: Rng): string {
  for (;;) {
    let b: string;
    if (rng.int(3) === 0) b = freshNonWord(rng) + 'o';
    else {
      const real = rng.pick(BASES.filter((x) => x.length >= 6));
      const i = 1 + rng.int(real.length - 3);
      b = real.slice(0, i) + real[i + 1] + real[i] + real.slice(i + 2);
    }
    const stem = b.slice(0, -1);
    const all = [b, stem + 'a', b + 's', stem + 'as', stem + 'e', stem + 'es'];
    if (b.endsWith('o') && all.every((w) => !isDictionaryWord(w))) return b;
  }
}

test('ROW-012-inclusive-forms-on-correct-bases-not-flagged-and-on-misspelled-bases-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  for (const b of BASES) requireDictionary([b, b.slice(0, -1) + 'a', b + 's', b.slice(0, -1) + 'as'], 'ROW-012 correct bases');
  requireNotDictionary(['canditado', 'canditada'], 'ROW-012 named misspelled base');

  type Item = { form: string; ok: boolean; cut?: number; label: string };
  const items: Item[] = [
    { form: 'candidato/a', ok: true, label: 'named candidato/a' },
    { form: 'todos/as', ok: true, label: 'named todos/as' },
    { form: 'l@s', ok: true, label: 'named l@s' },
    { form: 'tod@s', ok: true, label: 'named tod@s' },
    { form: 'todxs', ok: true, label: 'named todxs' },
    { form: 'todes', ok: true, label: 'named todes' },
    { form: 'canditado/a', ok: false, cut: 9, label: 'named canditado/a' },
  ];
  for (const base of rng.shuffle(BASES).slice(0, 6)) for (const s of shapes(base)) items.push({ form: s.form, ok: true, label: `inclusive form of ${base}` });
  for (let i = 0; i < 4; i++) {
    const base = misspelledBase(rng);
    for (const s of rng.shuffle(shapes(base)).slice(0, 4)) items.push({ form: s.form, ok: false, cut: s.cut, label: `inclusive form of misspelled ${base}` });
  }

  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ');
  rng.shuffle(items).forEach((it, i) => {
    const opening = i % 9 === 4;
    if (opening) o.put('. ');
    const form = opening ? titleCase(it.form) : it.form;
    if (it.ok) o.keep(form, it.label);
    else o.flag(form, it.label, it.cut);
    o.put(' ' + fillers(rng, 1 + rng.int(2)) + (rng.int(4) === 0 ? ', ' : ' '));
  });
  o.put(fillers(rng, 1));
  await expectExact(o, `ROW-012: inclusive forms on correct bases are not flagged and those on misspelled bases are flagged from their first letter (seed ${rng.seed})`);
});

test('ROW-012-control-the-misspelled-bases-alone-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ').flag('canditado', 'canditado alone');
  for (let i = 0; i < 4; i++) o.put(' ' + fillers(rng, 1) + ' ').flag(misspelledBase(rng), 'misspelled base alone');
  o.put(' ' + fillers(rng, 2));
  await expectExact(o, `ROW-012 control: the misspelled bases are flagged at their offsets standing alone (seed ${rng.seed})`);
});
