// Purpose: ROW-139 and ROW-140 (REQ-001) — through the check endpoint, words that are correct both with
// and without an accent (esta/está, publico/público, mas/más …) are never flagged, and words carrying an
// extra or misplaced accent (fué, exámen, jóven, and fresh ones) are flagged with the correct form first.
// Provenance: pairs and named examples hand-listed by the test-author pass (slice skeleton, batch words);
// generated wrong-accent words come from the harness's filler words and from tests/invariants/
// spanish-dictionary.ts (accentPopulation, dictionary-es 4.0.0 pinned); every word is kept only when the
// oracle confirms the fact the test relies on; no expected value comes from the product.
//
// Test argument
// ROW-139 promise: words correct with and without an accent (esta and está, publico and público, mas and
//   más) are never flagged (REQ-001 fail-if: "a correctly spelled dictionary word other than ano or anos
//   is flagged"; A-012: the diacritic accents the RAE advises against but does not call errors, sólo and
//   éste, are accepted).
// ROW-139 wrong product: an accent rule layered on the dictionary — "if the accented form is a word, the
//   unaccented one is a missing accent" — so esta, publico, mas, solo, termino are flagged as missing their
//   accent; or the reverse, an "over-accented" rule that flags está, más, sólo, éste.
// ROW-139 given: every pair of a hand list (esta/está, publico/público, mas/más, ingles/inglés,
//   practico/práctico, termino/término, calculo/cálculo, solo/sólo, este/éste, tu/tú, el/él, si/sí,
//   aun/aún, que/qué, como/cómo, donde/dónde, cuando/cuándo …) whose both forms the oracle holds, both
//   forms of each, a few opening a sentence, beside three accent-stripped population words (gestion-like,
//   which must be flagged) as near misses; when: the text is sent to POST /api/check; then: the flags are
//   exactly the three near misses at their offsets.
// ROW-139 controls: the control case (a fresh non-word flagged); the near misses in the same text show the
//   accent path is reached in the very text judged.
// ROW-139 technique: the whole named family every run ("never" over every pair the oracle confirms), with
//   the opposite-class decoys beside them.
// cases: ROW-139 target=ROW-139-words-correct-with-and-without-an-accent-are-never-flagged control=ROW-139-ROW-140-control-a-fresh-non-word-is-flagged-at-its-offsets
//
// ROW-140 promise: words with an extra or misplaced accent (fué, exámen, jóven) are flagged, the correct
//   form first among the suggestions (REQ-001: every word the dictionary does not hold is flagged, a wrong
//   accent counting as a misspelling; REQ-010: the expected correction of an accent error is the first
//   suggestion).
// ROW-140 wrong product: a checker that strips accents before the lookup (so any accent placement of a
//   correct word passes), or one whose suggestions rank by plain edit distance without accent weighting,
//   putting another word before "examen".
// ROW-140 given: fué, exámen, jóven; two fresh extra-accent words (a filler word given an acute accent it
//   does not take) and two fresh misplaced-accent words (a population word with its accent moved to another
//   vowel) — each kept only when the oracle holds exactly one single-accent spelling of its letters, the
//   correct one; when: the text is sent to POST /api/check; then: the flags are exactly those seven at their
//   offsets, each with its one correct spelling as the first suggestion.
// ROW-140 controls: the shared control case; the correct spellings placed beside them (not flagged).
// ROW-140 technique: the row's named examples plus generated wrong accents on both sides (added, moved),
//   with the expected correction made unique by the oracle before it is asserted first.
// cases: ROW-140 target=ROW-140-extra-or-misplaced-accents-are-flagged-with-the-correct-form-first control=ROW-139-ROW-140-control-a-fresh-non-word-is-flagged-at-its-offsets

import { expect, test } from '@playwright/test';
import { accentPopulation, asActor, checkText, fillerWords, freshNonWord, freshRandom, isDictionaryWord, stripAcuteAccents, type Rng } from './harness';
import { firstSuggestionAt, flagDiff, layout, singleAccentForms, titleEs, type Item } from './words-helpers';

const PAIRS: [string, string][] = [
  ['esta', 'está'], ['publico', 'público'], ['mas', 'más'], ['ingles', 'inglés'], ['practico', 'práctico'],
  ['termino', 'término'], ['calculo', 'cálculo'], ['deposito', 'depósito'], ['solo', 'sólo'], ['este', 'éste'],
  ['animo', 'ánimo'], ['continuo', 'continúo'], ['critico', 'crítico'], ['valido', 'válido'], ['ultimo', 'último'],
  ['numero', 'número'], ['transito', 'tránsito'], ['tu', 'tú'], ['el', 'él'], ['se', 'sé'], ['de', 'dé'],
  ['mi', 'mí'], ['si', 'sí'], ['aun', 'aún'], ['que', 'qué'], ['como', 'cómo'], ['donde', 'dónde'],
  ['cuando', 'cuándo'], ['solicito', 'solícito'],
];

/** The single-accent spellings of `letters` (accent removed) that the oracle holds. */
const heldSpellings = (letters: string) => singleAccentForms(stripAcuteAccents(letters)).filter((w) => isDictionaryWord(w));

function strippedNearMisses(rng: Rng, n: number): string[] {
  return rng.shuffle(accentPopulation()).slice(0, n).map((p) => p.stripped);
}

test('ROW-139-words-correct-with-and-without-an-accent-are-never-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const pairs = PAIRS.filter(([a, b]) => isDictionaryWord(a) && isDictionaryWord(b));
  expect(pairs.length, 'ROW-139 setup: the oracle confirms most of the named pairs').toBeGreaterThanOrEqual(25);
  const misses = strippedNearMisses(rng, 3);
  const items: Item[] = rng.shuffle([...pairs.flat(), ...misses]).map((word) => {
    const initial = !misses.includes(word) && rng.int(8) === 0;
    return { word: initial ? titleEs(word) : word, initial };
  });
  const { text, items: placed } = layout(rng, items, { min: 0, max: 1 });
  const expected = placed.filter((p) => misses.includes(p.word));
  expect(expected.length, 'ROW-139 setup: each near miss stands once').toBe(3);

  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, expected),
    `ROW-139: in ${JSON.stringify(text)} no word of ${pairs.map((p) => p.join('/')).join(', ')} is flagged; only ${misses.join(', ')} are (seed ${rng.seed})`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});

function extraAccent(rng: Rng, base: string): string | null {
  const held = heldSpellings(base);
  if (held.length !== 1 || held[0] !== base) return null;
  const wrong = singleAccentForms(base).filter((w) => w !== base);
  return wrong.length ? rng.pick(wrong) : null;
}

function movedAccent(rng: Rng, word: string): string | null {
  const held = heldSpellings(word);
  if (held.length !== 1 || held[0] !== word) return null;
  const wrong = singleAccentForms(stripAcuteAccents(word)).filter((w) => w !== word && w !== stripAcuteAccents(word));
  return wrong.length ? rng.pick(wrong) : null;
}

test('ROW-140-extra-or-misplaced-accents-are-flagged-with-the-correct-form-first', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const wrongToRight = new Map<string, string>([
    ['fué', 'fue'],
    ['exámen', 'examen'],
    ['jóven', 'joven'],
  ]);
  for (const [w, r] of wrongToRight) {
    const held = heldSpellings(w);
    if (held.length !== 1 || held[0] !== r) throw new Error(`setup: the oracle does not hold exactly one spelling of ${w}'s letters (${held.join(', ')})`);
  }
  let added = 0;
  for (const base of rng.shuffle(fillerWords().filter((w) => w.length >= 6 && !/[áéíóú]/.test(w)))) {
    const w = added < 2 ? extraAccent(rng, base) : null;
    if (w && !wrongToRight.has(w)) {
      wrongToRight.set(w, base);
      added++;
    }
  }
  let moved = 0;
  for (const p of rng.shuffle(accentPopulation()).slice(0, 200)) {
    const w = moved < 2 ? movedAccent(rng, p.word) : null;
    if (w && !wrongToRight.has(w)) {
      wrongToRight.set(w, p.word);
      moved++;
    }
  }
  expect({ added, moved }, 'ROW-140 setup: two fresh extra-accent and two fresh moved-accent words').toEqual({ added: 2, moved: 2 });
  for (const w of wrongToRight.keys()) if (isDictionaryWord(w)) throw new Error(`setup: the oracle holds ${w}`);

  const decoys = rng.shuffle([...wrongToRight.values()]).slice(0, 3);
  const items: Item[] = rng.shuffle([...wrongToRight.keys(), ...decoys]).map((word) => ({ word }));
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => wrongToRight.has(p.word));
  expect(expected.length, 'ROW-140 setup: every wrong-accent word stands once').toBe(wrongToRight.size);

  const answer = await checkText(text);
  expect(
    {
      flags: flagDiff(text, answer, expected),
      firstSuggestions: expected.map((p) => `${p.word} → ${firstSuggestionAt(answer, p)}`),
    },
    `ROW-140: in ${JSON.stringify(text)} every extra or misplaced accent is flagged with its correct spelling first (seed ${rng.seed})`,
  ).toEqual({
    flags: { notFlagged: [], flaggedWrongly: [] },
    firstSuggestions: expected.map((p) => `${p.word} → ${wrongToRight.get(p.word)}`),
  });
});

test('ROW-139-ROW-140-control-a-fresh-non-word-is-flagged-at-its-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, items),
    `ROW-139/ROW-140 control: the endpoint flags exactly the fresh non-word "${nonWord}" where it stands in ${JSON.stringify(text)}`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});
