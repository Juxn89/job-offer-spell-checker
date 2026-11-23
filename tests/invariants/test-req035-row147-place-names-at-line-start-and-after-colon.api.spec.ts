// Purpose: ROW-147 (REQ-035) — through the check endpoint, country, capital and major-city names of the
// Spanish-speaking countries, from an independent list, are not flagged at a line start or after a colon,
// and a capitalised word after a colon that is neither a dictionary word nor accent-restorable to one
// (Empresa: Tecnosoluciones) is not flagged — while a fresh name opening a line is.
// Provenance: the place names hand-typed from general geography (the 21 Spanish-speaking countries, their
// capitals and largest cities) — not read from, filtered by or checked against the product or its
// dictionary; the row's named Tecnosoluciones; names fresh per run (freshName); no expected value comes
// from the product.
//
// Test argument
// ROW-147 promise: country, capital and major-city names of Spanish-speaking countries are not flagged
//   at a line start or after a colon, and a capitalised word after a colon that is not in the
//   dictionary and whose accent-restored form is not a word (Empresa: Tecnosoluciones) is not flagged
//   (REQ-035 fail-if arm 3; A-046 "after a colon, a capitalised word not in the dictionary is treated as
//   a name unless the same word with its accents restored is in the dictionary"; A-031 the start of a
//   line stays a sentence start).
// ROW-147 wrong product: the bare dictionary with REQ-035's sentence starts, which — the dictionary
//   lacking Bogotá, Medellín, Tegucigalpa, Managua or Valparaíso — flags every offer whose location
//   line opens with its city ("Bogotá, Colombia") or whose "Ubicación: Medellín" is read as a sentence
//   start; or one that knows the countries but not the cities; or one that still treats the word after a
//   colon as a sentence start, so "Empresa: Tecnosoluciones" is flagged.
// ROW-147 given: ~110 place names (multi-word ones whole), each opening a line (bare, after a bullet)
//   and after a "Label: " colon; Tecnosoluciones and fresh names after a colon; near misses in the same
//   text: fresh names opening a line (flagged — line starts are checked); when: POST /api/check, the
//   list split over pages; then: on each page exactly the near misses are flagged.
// ROW-147 controls: fresh names opening lines, in a text with no place names, are flagged — the
//   line-start check is live, so the place names' silence is acceptance.
// ROW-147 technique: an independent list (geography, not the dictionary), the whole list every run in a
//   fresh order; decoys of the same shape (capitalised, unknown) at the same line starts; exact
//   comparison.
// cases: ROW-147 target=ROW-147-place-names-of-spanish-speaking-countries-not-flagged-at-a-line-start-or-after-a-colon control=ROW-147-control-fresh-names-opening-a-line-flagged

import { test } from '@playwright/test';
import { asActor, freshRandom } from './harness';
import { Offer, expectExact, fillers, freshName, paginate, requireDictionary } from './names-terms-helpers';

// Country · capital(s) · major cities.
const PLACES: string[][] = [
  ['España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao'],
  ['México', 'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Mérida', 'Querétaro'],
  ['Guatemala', 'Ciudad de Guatemala', 'Quetzaltenango'],
  ['Honduras', 'Tegucigalpa', 'San Pedro Sula', 'La Ceiba'],
  ['El Salvador', 'San Salvador', 'Santa Ana', 'San Miguel'],
  ['Nicaragua', 'Managua', 'León', 'Granada'],
  ['Costa Rica', 'San José', 'Alajuela', 'Cartago', 'Heredia'],
  ['Panamá', 'Ciudad de Panamá', 'Colón'],
  ['Cuba', 'La Habana', 'Santiago de Cuba', 'Camagüey', 'Holguín'],
  ['República Dominicana', 'Santo Domingo', 'Santiago de los Caballeros', 'Puerto Plata'],
  ['Puerto Rico', 'San Juan', 'Ponce', 'Bayamón'],
  ['Colombia', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'],
  ['Venezuela', 'Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay'],
  ['Ecuador', 'Quito', 'Guayaquil', 'Cuenca'],
  ['Perú', 'Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Cusco', 'Piura'],
  ['Bolivia', 'Sucre', 'La Paz', 'Santa Cruz de la Sierra', 'Cochabamba', 'El Alto'],
  ['Chile', 'Santiago', 'Valparaíso', 'Concepción', 'Antofagasta', 'Viña del Mar'],
  ['Argentina', 'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata', 'Tucumán'],
  ['Uruguay', 'Montevideo', 'Salto', 'Paysandú', 'Punta del Este'],
  ['Paraguay', 'Asunción', 'Ciudad del Este', 'Encarnación'],
  ['Guinea Ecuatorial', 'Malabo', 'Bata'],
];
const LABELS = ['Ubicación', 'Sede', 'Ciudad', 'País', 'Lugar de trabajo', 'Oficina', 'Destino'];

test('ROW-147-place-names-of-spanish-speaking-countries-not-flagged-at-a-line-start-or-after-a-colon', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireDictionary(LABELS.flatMap((l) => l.split(' ')), 'ROW-147 labels');
  const names = [...new Set(PLACES.flat())];
  type Item = { kind: 'line' | 'bullet' | 'colon' | 'name-after-colon' | 'near-miss'; word: string };
  const items: Item[] = [
    ...names.map((w) => ({ kind: 'line' as const, word: w })),
    ...names.map((w) => ({ kind: rng.int(3) === 0 ? ('bullet' as const) : ('colon' as const), word: w })),
    ...names.map((w) => ({ kind: 'colon' as const, word: w })),
    { kind: 'name-after-colon', word: 'Tecnosoluciones' },
    ...Array.from({ length: 6 }, () => ({ kind: 'name-after-colon' as const, word: freshName(rng) })),
    ...Array.from({ length: 8 }, () => ({ kind: 'near-miss' as const, word: freshName(rng) })),
  ];
  const offers = paginate(
    rng.shuffle(items),
    (o, it) => {
      if (it.kind === 'line') o.keep(it.word, `${it.word} opening a line`).put(', ' + fillers(rng, 2) + '\n');
      else if (it.kind === 'bullet') o.put('• ').keep(it.word, `${it.word} after a bullet`).put(' ' + fillers(rng, 1) + '\n');
      else if (it.kind === 'colon') o.put(rng.pick(LABELS) + ': ').keep(it.word, `${it.word} after a colon`).put('\n');
      else if (it.kind === 'name-after-colon') o.put(rng.pick(['Empresa', 'Cliente', 'Marca']) + ': ').keep(it.word, `${it.word} after a colon`).put('\n');
      else o.flag(it.word, 'fresh name opening a line').put(', ' + fillers(rng, 2) + '\n');
    },
    (o) => o.put(fillers(rng, 3, { capital: true }) + '\n'),
    4_000,
  );
  // every page carries at least one near miss, so no page can pass on an empty answer
  for (const o of offers) if (o.expected.length === 0) o.flag(freshName(rng), 'fresh name opening a line').put(', ' + fillers(rng, 2));
  for (const o of offers) {
    await expectExact(o, `ROW-147: place names of Spanish-speaking countries are not flagged at a line start or after a colon, nor a name after a colon, while a fresh name opening a line is (seed ${rng.seed})`);
  }
});

test('ROW-147-control-fresh-names-opening-a-line-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 3, { capital: true }) + '\n');
  for (let i = 0; i < 4; i++) o.flag(freshName(rng), 'fresh name opening a line').put(', ' + fillers(rng, 2) + '\n');
  await expectExact(o, `ROW-147 control: fresh names opening lines are flagged (seed ${rng.seed})`);
});
