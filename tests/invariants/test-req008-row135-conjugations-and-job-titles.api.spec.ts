// Purpose: ROW-135 (REQ-008) — through the check endpoint, the full conjugation of frequent job-offer
// verbs, voseo included, and the gender and number forms of job titles are not flagged.
// Provenance: generated from Spanish conjugation rules (names-terms-helpers.ts regularConjugation: the
// regular endings, the -car/-gar/-zar spelling changes, the -zc- of ofrecer, voseo present and
// imperative) over a hand-typed list of job-offer verbs, tener's irregular paradigm typed out in full,
// and job titles inflected by the gender and number rules typed below — a source independent of the
// product's dictionary; fresh non-words per run; no expected value comes from the product.
//
// Test argument
// ROW-135 promise: every simple form of frequent job-offer verbs, voseo included, and every gender and
//   number form of job titles, drawn from a source independent of the product's dictionary, is not
//   flagged (REQ-008 "General Spanish ... voseo forms are all accepted"; A-012).
// ROW-135 wrong product: the bare vendored dictionary, which (checked while writing this test) lacks
//   every voseo form — "trabajás", "aprendé", "tenés" — so an Argentine or Uruguayan offer is flagged
//   on every verb; or a checker built from a sample that skips rarer tenses (the future subjunctive
//   "trabajare", the -se imperfect) or feminine titles ("gerenta", "ingenieras").
// ROW-135 given: ~1,500 verb forms (25 verbs, every simple tense and person, the participle's four
//   forms, voseo present and imperative) and ~150 title forms, in fresh order across pages, each page
//   each closed by one fresh non-word; when: POST /api/check, page by page; then: on each page exactly
//   the fresh non-word is flagged.
// ROW-135 controls: a fresh non-word among a few verb forms is flagged at its offsets — the path to a
//   flag is reached on every page and on its own.
// ROW-135 technique: a property over the whole generated population (no sampling: the row says "full
//   conjugation"), from rules, never from the dictionary under test; exact comparison per page.
// cases: ROW-135 target=ROW-135-full-conjugations-with-voseo-and-job-title-forms-not-flagged control=ROW-135-control-a-fresh-non-word-among-verb-forms-is-flagged

import { test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom } from './harness';
import { Offer, expectExact, fillers, paginate, regularConjugation } from './names-terms-helpers';

// Frequent verbs of job offers: regular ones (with spelling changes: buscar, analizar, entregar) and ofrecer.
const REGULAR = [
  'trabajar', 'buscar', 'ofrecer', 'gestionar', 'desarrollar', 'coordinar', 'liderar', 'colaborar', 'participar',
  'manejar', 'administrar', 'presentar', 'postular', 'contratar', 'integrar', 'apoyar', 'supervisar', 'analizar',
  'entregar', 'aprender', 'responder', 'comprender', 'cumplir', 'recibir', 'asistir',
];

// tener, irregular: every simple form, voseo included (tenés, tené).
const TENER = [
  'tener', 'teniendo', 'tenido', 'tenida', 'tenidos', 'tenidas',
  'tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen', 'tenés',
  'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron',
  'tenía', 'tenías', 'teníamos', 'teníais', 'tenían',
  'tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán',
  'tendría', 'tendrías', 'tendríamos', 'tendríais', 'tendrían',
  'tenga', 'tengas', 'tengamos', 'tengáis', 'tengan',
  'tuviera', 'tuvieras', 'tuviéramos', 'tuvierais', 'tuvieran',
  'tuviese', 'tuvieses', 'tuviésemos', 'tuvieseis', 'tuviesen',
  'tuviere', 'tuvieres', 'tuviéremos', 'tuviereis', 'tuvieren',
  'ten', 'tené', 'tened',
];

// Job titles by inflection class: -o (o, a, os, as), -or (or, ora, ores, oras), -ista (ista, istas),
// and the -e/-ar titles typed with their forms.
const IN_O = ['ingeniero', 'técnico', 'operario', 'secretario', 'cajero', 'mesero', 'enfermero', 'arquitecto', 'médico', 'mecánico', 'ejecutivo', 'encargado', 'empleado', 'abogado', 'camarero', 'cocinero'];
const IN_OR = ['desarrollador', 'programador', 'diseñador', 'administrador', 'contador', 'director', 'coordinador', 'vendedor', 'conductor', 'repartidor', 'supervisor', 'consultor', 'profesor', 'asesor', 'auditor', 'gestor'];
const IN_ISTA = ['analista', 'recepcionista', 'electricista', 'especialista', 'periodista'];
const TYPED_TITLES = ['jefe', 'jefa', 'jefes', 'jefas', 'gerente', 'gerenta', 'gerentes', 'gerentas', 'asistente', 'asistenta', 'asistentes', 'asistentas', 'dependiente', 'dependienta', 'dependientes', 'dependientas', 'auxiliar', 'auxiliares', 'representante', 'representantes', 'agente', 'agentes'];

function titleForms(): string[] {
  const out: string[] = [...TYPED_TITLES];
  for (const t of IN_O) out.push(t, t.slice(0, -1) + 'a', t + 's', t.slice(0, -1) + 'as');
  for (const t of IN_OR) out.push(t, t + 'a', t + 'es', t + 'as');
  for (const t of IN_ISTA) out.push(t, t + 's');
  return out;
}

function population(): { word: string; label: string }[] {
  return [
    ...REGULAR.flatMap((v) => regularConjugation(v).map((f) => ({ word: f, label: `form of ${v}` }))),
    ...TENER.map((f) => ({ word: f, label: 'form of tener' })),
    ...titleForms().map((f) => ({ word: f, label: 'job title form' })),
  ];
}

test('ROW-135-full-conjugations-with-voseo-and-job-title-forms-not-flagged', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const rng = freshRandom();
  const words = population();
  if (words.length < 1_500) throw new Error(`setup: the generated population has only ${words.length} forms`);
  const offers = paginate(
    rng.shuffle(words),
    (o, w) => {
      o.keep(w.word, w.label).put(rng.int(5) === 0 ? ', ' : ' ');
    },
    (o) => o.put(fillers(rng, 2, { capital: true }) + ' '),
  );
  // one fresh non-word closing every page, after all its forms (a product that stops early misses it)
  for (const o of offers) o.put(' ' + fillers(rng, 1) + ' ').flag(freshNonWord(rng), 'fresh non-word closing the page').put('.');
  for (const page of offers) {
    await expectExact(page, `ROW-135: full conjugations (voseo included) and job-title forms from an independent source are not flagged (seed ${rng.seed})`);
  }
});

test('ROW-135-control-a-fresh-non-word-among-verb-forms-is-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const forms = rng.shuffle(population()).slice(0, 8);
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ');
  forms.forEach((f, i) => {
    o.keep(f.word, f.label).put(' ');
    if (i === 3) o.flag(freshNonWord(rng), 'fresh non-word').put(' ');
  });
  o.put(fillers(rng, 2));
  await expectExact(o, `ROW-135 control: a fresh non-word among verb forms is flagged at its offsets (seed ${rng.seed})`);
});
