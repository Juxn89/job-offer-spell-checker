// Purpose: ROW-137 and ROW-148 (REQ-001, REQ-044) — through the check endpoint, a word missing its ñ or ü
// is flagged in lower case, title case (mid-sentence too) and capitals, with the restored word as its
// first suggestion; and ano and anos, in any capitalisation, ANO and ANOS included, are always flagged
// with año or años first, while words that merely contain them (manos, humano, anoche) are not.
// Provenance: candidate words hand-listed by the test-author pass (slice skeleton, batch words) and
// drawn from tests/invariants/spanish-dictionary.ts (accentPopulation, dictionary-es 4.0.0 pinned), each
// kept only when the oracle holds the word, does not hold its ñ/ü-stripped form, and holds no other word
// one letter away from that form — so "the first suggestion restores it" has one right answer; ano/anos
// and their decoys are REQ-044's and the test's own; no expected value comes from the product.
//
// Test argument
// ROW-137 promise: a missing ñ or ü is flagged in lower case, title case and capitals, a capitalised
//   mid-sentence word included, and the first suggestion restores it (REQ-001: every word the dictionary
//   does not hold is flagged, A-004 accents included; REQ-009: a capitalised mid-sentence word whose
//   restored form is a dictionary word is flagged, and all-capital words are never names; REQ-010: the
//   expected correction of a one-letter error comes first).
// ROW-137 wrong product: a checker that folds ñ→n and ü→u before the lookup (as many ASCII-minded
//   normalisers do), so "bilingue" and "ensenanza" pass; or one that takes "Bilingue" mid-sentence for a
//   name because only acute accents are restored before the name test; or one whose suggestions rank
//   "bilingües" or an unrelated word before "bilingüe".
// ROW-137 given: six fresh bases (hand-listed job-offer words such as bilingüe, enseñanza, compañero,
//   desempeño, vergüenza, and dictionary-population words with ñ or ü), each written stripped three ways —
//   lower case mid-sentence, Title case mid-sentence, and in capitals when longer than 5 letters — beside
//   two correct bases as near misses; when: the text is sent to POST /api/check; then: the flags are
//   exactly the stripped forms at their offsets, and each one's first suggestion is its base (compared
//   without regard to letter case: "restores it" is about the ñ/ü, REQ-011 fits the case on replace).
// ROW-137 controls: the control case (a fresh non-word flagged at its offsets); the correct bases in the
//   same text are not flagged.
// ROW-137 technique: hand-named common words plus a fresh draw from the dictionary population, each
//   checked by the oracle for a unique one-letter correction; every case form of every base.
// cases: ROW-137 target=ROW-137-missing-n-tilde-or-u-diaeresis-flagged-in-every-case-with-the-restored-word-first control=ROW-137-ROW-148-control-a-fresh-non-word-is-flagged-at-its-offsets
//
// ROW-148 promise: ano and anos, in any case, ANO and ANOS included, are always flagged with año or años
//   as the first suggestion (REQ-044; A-047, A-051: ANO and ANOS are exceptions to the short all-capital
//   rule; A-050: REQ-001's "a dictionary word is not flagged" excludes them).
// ROW-148 wrong product: a special case written for lower-case "ano" only (Ano, ANO, ANOS pass — the
//   short-capitals exemption wins), or a substring rule that flags "manos", "humano" or "anoche" too, or
//   a suggestion list that puts "ano" variants or "anos" before "año".
// ROW-148 given: ano, anos, Ano (mid-sentence and sentence-initial), Anos, ANO, ANOS and one fresh mixed-
//   case form, among the near misses año, años, AÑO, manos, humano, anoche, anotar, temprano; when: the
//   text is sent to POST /api/check; then: the flags are exactly the ano/anos forms at their offsets, and
//   each first suggestion is año (for ano) or años (for anos), compared without regard to letter case.
// ROW-148 controls: the shared control case; the near misses (dictionary words containing "ano") show the
//   flags follow the word, not the letters.
// ROW-148 technique: every capitalisation class named by the row plus a fresh random one, with substring
//   decoys.
// cases: ROW-148 target=ROW-148-ano-and-anos-in-any-case-are-flagged-with-ano-or-anos-first control=ROW-137-ROW-148-control-a-fresh-non-word-is-flagged-at-its-offsets

import { expect, test } from '@playwright/test';
import {
  accentPopulation,
  asActor,
  checkText,
  freshNonWord,
  freshRandom,
  hasInclusiveReading,
  isDictionaryWord,
  type Rng,
} from './harness';
import { dictionaryNeighbours, firstSuggestionAt, flagDiff, layout, titleEs, upperEs, type Item } from './words-helpers';

const NAMED_BASES = [
  'bilingüe', 'enseñanza', 'compañero', 'compañía', 'desempeño', 'vergüenza', 'lingüística', 'antigüedad',
  'pequeño', 'diseño', 'español', 'mañana', 'cigüeña', 'acompañar',
];

const stripNU = (w: string) => w.replace(/ñ/g, 'n').replace(/ü/g, 'u');

/** A base qualifies when the oracle holds it, holds no form of its stripped spelling, and holds no other word one letter from it. */
function qualifies(base: string): boolean {
  const s = stripNU(base);
  if (s === base || !isDictionaryWord(base)) return false;
  if (isDictionaryWord(s) || isDictionaryWord(titleEs(s)) || isDictionaryWord(upperEs(s)) || hasInclusiveReading(s)) return false;
  if (s === 'ano' || s === 'anos') return false;
  const near = dictionaryNeighbours(s);
  return near.length === 1 && near[0] === base;
}

function bases(rng: Rng): string[] {
  const named = rng.shuffle(NAMED_BASES.filter(qualifies)).slice(0, 4);
  const drawn = rng.shuffle(accentPopulation().map((p) => p.word).filter((w) => /[ñü]/.test(w))).filter(qualifies).slice(0, 2);
  return [...named, ...drawn];
}

const lower = (s: string | null) => (s === null ? null : s.toLocaleLowerCase('es'));

test('ROW-137-missing-n-tilde-or-u-diaeresis-flagged-in-every-case-with-the-restored-word-first', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const chosen = bases(rng);
  expect(chosen.length, 'ROW-137 setup: six bases with a unique one-letter correction (four named, two drawn)').toBe(6);
  const stripped = new Map<string, string>(); // written form → base
  for (const base of chosen) {
    const s = stripNU(base);
    stripped.set(s, base);
    stripped.set(titleEs(s), base);
    if (s.length > 5) stripped.set(upperEs(s), base);
  }
  const decoys = rng.shuffle(chosen).slice(0, 2);
  const items: Item[] = rng.shuffle([...stripped.keys(), ...decoys]).map((word) => ({ word }));
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => stripped.has(p.word));
  expect(expected.length, 'ROW-137 setup: every stripped form stands once').toBe(stripped.size);

  const answer = await checkText(text);
  expect(
    {
      flags: flagDiff(text, answer, expected),
      firstSuggestions: expected.map((p) => `${p.word} → ${lower(firstSuggestionAt(answer, p))}`),
    },
    `ROW-137: in ${JSON.stringify(text)} every ñ/ü-stripped form is flagged at its place, with its restored word first (seed ${rng.seed})`,
  ).toEqual({
    flags: { notFlagged: [], flaggedWrongly: [] },
    firstSuggestions: expected.map((p) => `${p.word} → ${stripped.get(p.word)}`),
  });
});

function mixedCase(rng: Rng, w: string): string {
  for (;;) {
    const m = [...w].map((c) => (rng.int(2) ? c.toUpperCase() : c)).join('');
    if (m !== w && m !== upperEs(w) && m !== titleEs(w)) return m;
  }
}

test('ROW-148-ano-and-anos-in-any-case-are-flagged-with-ano-or-anos-first', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const decoys = ['año', 'años', 'AÑO', 'manos', 'humano', 'anoche', 'anotar', 'temprano'];
  for (const d of decoys) if (!isDictionaryWord(d)) throw new Error(`setup: the dictionary oracle does not hold ${d}`);
  const fresh = mixedCase(rng, rng.pick(['ano', 'anos']));
  const forms: Item[] = [
    { word: 'ano' },
    { word: 'anos' },
    { word: 'Ano' },
    { word: 'Ano', initial: true },
    { word: 'Anos' },
    { word: 'ANO' },
    { word: 'ANOS' },
    { word: fresh },
  ];
  const isAno = (w: string) => /^anos?$/i.test(w);
  const items = rng.shuffle([...forms, ...decoys.map((word) => ({ word }))]);
  const { text, items: placed } = layout(rng, items);
  const expected = placed.filter((p) => isAno(p.word));
  expect(expected.length, 'ROW-148 setup: every ano/anos form stands in the text').toBe(forms.length);

  const answer = await checkText(text);
  expect(
    {
      flags: flagDiff(text, answer, expected),
      firstSuggestions: expected.map((p) => `${p.word} → ${lower(firstSuggestionAt(answer, p))}`),
    },
    `ROW-148: in ${JSON.stringify(text)} every ano/anos form is flagged with año/años first, and no word merely containing them is (seed ${rng.seed})`,
  ).toEqual({
    flags: { notFlagged: [], flaggedWrongly: [] },
    firstSuggestions: expected.map((p) => `${p.word} → ${/s$/i.test(p.word) ? 'años' : 'año'}`),
  });
});

test('ROW-137-ROW-148-control-a-fresh-non-word-is-flagged-at-its-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const answer = await checkText(text);
  expect(
    flagDiff(text, answer, items),
    `ROW-137/ROW-148 control: the endpoint flags exactly the fresh non-word "${nonWord}" where it stands in ${JSON.stringify(text)}`,
  ).toEqual({ notFlagged: [], flaggedWrongly: [] });
});
