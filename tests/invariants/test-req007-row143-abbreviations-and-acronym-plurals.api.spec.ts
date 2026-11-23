// Purpose: ROW-143 (REQ-007, REQ-035) — through the check endpoint, common job-offer abbreviations and
// acronym plurals (aprox., máx., S.A., EE. UU., KPIs, PyMEs …) from an independent list are not flagged,
// and the word after any accepted abbreviation is not a sentence start: a fresh name there is not flagged,
// while the same kind of name after an ordinary full stop is.
// Provenance: abbreviations hand-typed from the RAE's list of abbreviations (Diccionario panhispánico de
// dudas, appendix 2) as used in job offers, acronym plurals typed from job-offer usage — not read from the
// product or its dictionary; names fresh per run (freshName); no expected value comes from the product.
//
// Test argument
// ROW-143 promise: common job-offer abbreviations and acronym plurals from an independent list are not
//   flagged, and the word after any accepted abbreviation is not a sentence start (REQ-007 "common
//   abbreviations ending in a period ... are accepted"; REQ-035 / A-031 "a word after an accepted
//   abbreviation ... is not a sentence start").
// ROW-143 wrong product: one that accepts only the seven titles REQ-007 names, flagging "admón.",
//   "Avda." or "Ltda."; one that splits "EE. UU." or "S.A." and flags a fragment; one that flags the
//   acronym plurals "KPIs" or "PyMEs"; or one that accepts the abbreviation but still treats its period
//   as a sentence end, so the name after "aprox." or "S.A." is checked and flagged.
// ROW-143 given: ~30 abbreviations, each set in a sentence and followed by a fresh capitalised name; ~8
//   acronym plurals mid-sentence and opening a sentence; near misses in the same text: fresh names
//   after an ordinary word's full stop; when: POST /api/check; then: exactly the near-miss names are
//   flagged — no abbreviation, no acronym plural, no name after an abbreviation.
// ROW-143 controls: fresh names after ordinary full stops, in a text without abbreviations, are flagged
//   — the sentence-start check the abbreviations must switch off is live.
// ROW-143 technique: an independent list (the RAE's abbreviations), every entry every run, each
//   followed by a fresh name (no product can list them); decoys of the same shape after a real full
//   stop in the same text; exact comparison.
// cases: ROW-143 target=ROW-143-job-offer-abbreviations-and-acronym-plurals-not-flagged-and-the-word-after-one-not-a-sentence-start control=ROW-143-control-fresh-names-after-ordinary-full-stops-flagged

import { test } from '@playwright/test';
import { asActor, freshRandom } from './harness';
import { Offer, expectExact, fillers, freshName } from './names-terms-helpers';

const ABBREVIATIONS = [
  'aprox.', 'máx.', 'mín.', 'S.A.', 'S.L.', 'S.R.L.', 'S.A. de C.V.', 'Ltda.', 'Cía.', 'EE. UU.', 'RR. HH.',
  'Av.', 'Avda.', 'tel.', 'núm.', 'pág.', 'p. ej.', 'etc.', 'Lic.', 'Ing.', 'Sr.', 'Sra.', 'Srta.', 'Dr.', 'Dra.',
  'Ud.', 'Uds.', 'dpto.', 'admón.', 'C.P.', 'Arq.', 'Prof.',
];
const ACRONYM_PLURALS = ['KPIs', 'PyMEs', 'ONGs', 'CVs', 'APIs', 'ERPs', 'CRMs', 'PCs'];

test('ROW-143-job-offer-abbreviations-and-acronym-plurals-not-flagged-and-the-word-after-one-not-a-sentence-start', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (const a of rng.shuffle(ABBREVIATIONS)) {
    o.put(' ' + fillers(rng, 1 + rng.int(2)) + ' ').keep(a, `abbreviation ${a}`).put(' ').keep(freshName(rng), `fresh name after ${a}`).put(' ' + fillers(rng, 1));
    if (rng.int(4) === 0) o.put('. ').flag(freshName(rng), 'fresh name after an ordinary full stop').put(' ' + fillers(rng, 1));
  }
  for (const p of rng.shuffle(ACRONYM_PLURALS)) {
    if (rng.int(2) === 0) o.put('. ').keep(p, `${p} opening a sentence`).put(' ' + fillers(rng, 2));
    else o.put(' ' + fillers(rng, 1) + ' ').keep(p, `${p} mid-sentence`).put(' ' + fillers(rng, 1));
  }
  o.put(' ' + fillers(rng, 1) + '. ').flag(freshName(rng), 'fresh name after an ordinary full stop').put(' ' + fillers(rng, 2) + '.');
  await expectExact(o, `ROW-143: job-offer abbreviations and acronym plurals are not flagged, and a fresh name after any abbreviation is not taken as a sentence start (seed ${rng.seed})`);
});

test('ROW-143-control-fresh-names-after-ordinary-full-stops-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 3, { capital: true }));
  for (let i = 0; i < 4; i++) o.put('. ').flag(freshName(rng), 'fresh name after an ordinary full stop').put(' ' + fillers(rng, 3));
  o.put('.');
  await expectExact(o, `ROW-143 control: fresh names after ordinary full stops are flagged (seed ${rng.seed})`);
});
