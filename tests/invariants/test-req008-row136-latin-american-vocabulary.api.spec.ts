// Purpose: ROW-136 (REQ-008) — through the check endpoint, a sample of Latin American Spanish vocabulary
// from a word source independent of the product's dictionary is not flagged.
// Provenance: hand-typed from the Diccionario de la lengua española (RAE/ASALE, 23rd edition) entries
// that carry an American country mark (Am., Arg., Méx., Col., Perú, Ur., Cuba …), as the author knows
// them — not read from, filtered by or checked against the product's dictionary for inclusion; fresh
// non-words per run; no expected value comes from the product.
//
// Test argument
// ROW-136 promise: Latin American Spanish vocabulary is accepted (REQ-008 "Spain and Latin American
//   spellings ... are all accepted"; A-012 "general Spanish under the current RAE spelling rules").
// ROW-136 wrong product: the bare vendored dictionary (RLA-ES), which — as observed while writing this
//   test — holds computadora and celular but not laburo, chévere, palta, chompa, overol, ameritar,
//   parquear, parqueadero, guagua, tianguis or lapicera, so offers from Argentina, Peru, Colombia,
//   Mexico or Cuba are flagged on their everyday words.
// ROW-136 given: ~60 DLE Americanisms and common Latin American job-offer words (nouns, verbs and some
//   plurals), each mid-sentence in lower case, a third also opening a sentence; one fresh non-word in
//   the text; when: POST /api/check; then: exactly the fresh non-word is flagged.
// ROW-136 controls: a fresh non-word among a few of these words is flagged at its offsets — the path to
//   a flag is reached, so the vocabulary's silence is acceptance.
// ROW-136 technique: an independent word source (the DLE's regional marks), the whole list every run in
//   a fresh order and casing; exact comparison.
// cases: ROW-136 target=ROW-136-latin-american-vocabulary-from-an-independent-source-not-flagged control=ROW-136-control-a-fresh-non-word-among-the-vocabulary-is-flagged

import { test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom } from './harness';
import { Offer, expectExact, fillers, titleCase } from './names-terms-helpers';

const LATAM = [
  'computadora', 'computadoras', 'computación', 'celular', 'celulares', 'manejar', 'carro', 'carros', 'chofer',
  'mesero', 'mesera', 'mozo', 'moza', 'plomero', 'pasante', 'pasantía', 'pasantías', 'postulante', 'postulantes',
  'aguinaldo', 'quincena', 'cuadra', 'cuadras', 'departamento', 'estacionamiento', 'colectivo', 'ómnibus', 'boleto',
  'cédula', 'boleta', 'laburo', 'laburar', 'chamba', 'chambear', 'rentar', 'platicar', 'ahorita', 'chévere',
  'refrigerador', 'heladera', 'vereda', 'banqueta', 'pileta', 'frijol', 'frijoles', 'durazno', 'palta', 'elote',
  'choclo', 'jugo', 'recámara', 'chamarra', 'chompa', 'overol', 'plata', 'vidriera', 'chequear', 'ameritar',
  'egresado', 'egresada', 'licenciatura', 'parquear', 'parqueadero', 'alberca', 'regadera', 'camión', 'guagua',
  'tianguis', 'saco', 'lapicera', 'arriendo', 'arrendar', 'jalar', 'cobija',
];

test('ROW-136-latin-american-vocabulary-from-an-independent-source-not-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  const items = rng.shuffle([...LATAM.map((w) => ({ w, opening: false })), ...rng.shuffle(LATAM).slice(0, 25).map((w) => ({ w, opening: true }))]);
  const nonWordAt = rng.int(items.length);
  items.forEach((it, i) => {
    if (it.opening) o.put('. ').keep(titleCase(it.w), `${it.w} opening a sentence`);
    else o.put(' ' + fillers(rng, 1) + ' ').keep(it.w, `${it.w} mid-sentence`);
    if (i === nonWordAt) o.put(' ' + fillers(rng, 1) + ' ').flag(freshNonWord(rng), 'fresh non-word');
    o.put(rng.int(4) === 0 ? ',' : '');
  });
  o.put(' ' + fillers(rng, 2) + '.');
  await expectExact(o, `ROW-136: Latin American vocabulary from an independent source (the DLE's American entries) is not flagged (seed ${rng.seed})`);
});

test('ROW-136-control-a-fresh-non-word-among-the-vocabulary-is-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (const w of rng.shuffle(LATAM).slice(0, 3)) o.put(' ').keep(w, w);
  o.put(' ').flag(freshNonWord(rng), 'fresh non-word');
  for (const w of rng.shuffle(LATAM).slice(0, 3)) o.put(' ').keep(w, w);
  o.put('.');
  await expectExact(o, `ROW-136 control: a fresh non-word among the vocabulary is flagged at its offsets (seed ${rng.seed})`);
});
