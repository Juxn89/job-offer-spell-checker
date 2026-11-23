// Purpose: the suggestions batch's generated populations — misspellings made from the ratified
// dictionary with a known intended word (one-letter, accent and sound-alike errors), the misspellings
// near an offensive word, and the independent list of Spanish vulgar or offensive words — so the
// REQ-010/REQ-011 rows' expected results come from the dictionary and this list, never from the product.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch suggestions); every word it
// returns is generated from dictionary-es 4.0.0 through tests/invariants/spanish-dictionary.ts (the
// SHA-256-pinned oracle, D-029) with the caller's fresh randomness; nothing is read from the product.
//
// What it never does: it never imports, calls or reads the product's checker, never asks the product
// for a suggestion, and never applies the product's exemptions; it leaves out the words where a
// ratified exemption would make "flagged" the wrong expectation (inclusive forms, capitalised names,
// short words), saying so beside each filter.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hasInclusiveReading, isDictionaryWord, stripAcuteAccents } from './spanish-dictionary';

/** The minimal random source the generators need (the harness's `freshRandom()` satisfies it). */
export type Pick = { int(n: number): number; pick<T>(items: readonly T[]): T };

/** A misspelling made from a dictionary word: `wrong` is what the writer typed, `intended` what they meant. */
export type Misspelling = {
  intended: string;
  wrong: string;
  kind: 'substitution' | 'insertion' | 'deletion' | 'transposition' | 'accent' | SoundClass;
};

/** The sound-alike confusion classes ROW-142 names: b and v, ll and y, s c z, a dropped h, g and j. */
export type SoundClass = 'b-v' | 'll-y' | 's-c-z' | 'h' | 'g-j';
export const SOUND_CLASSES: readonly SoundClass[] = ['b-v', 'll-y', 's-c-z', 'h', 'g-j'];

const LETTERS = 'abcdefghijklmnñopqrstuvwxyzáéíóúü';
const LOWER_WORD = /^[a-zñáéíóúü]+$/;

let stemsCache: string[] | undefined;

/**
 * The lower-case, letters-only stems of the ratified dictionary (dictionary-es 4.0.0's word list, the
 * flags cut off), each confirmed by the oracle. Calling the oracle first makes its SHA-256 pin run, so
 * a changed dictionary fails here as `setup:` before any word is used.
 */
export function dictionaryStems(): string[] {
  if (stemsCache) return stemsCache;
  isDictionaryWord('casa'); // loads the oracle and verifies the pinned release
  const path = fileURLToPath(new URL('../../src/checker/dictionary/es.dic.txt', import.meta.url));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const w = line.split('/')[0].trim();
    if (!LOWER_WORD.test(w) || seen.has(w)) continue;
    seen.add(w);
    if (isDictionaryWord(w)) out.push(w);
  }
  stemsCache = out;
  return out;
}

const capitalise = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * True when `w` must be flagged by every ratified rule: lower case, letters only, at least 5 letters,
 * not a dictionary word, not with an initial capital either (a lower-cased name, which a rule could
 * treat as the name), and with no inclusive reading (REQ-006 accepts those).
 */
export function mustBeFlagged(w: string): boolean {
  return w.length >= 5 && LOWER_WORD.test(w) && !isDictionaryWord(w) && !isDictionaryWord(capitalise(w)) && !hasInclusiveReading(w);
}

/** Every dictionary word one edit from `w`: one letter substituted (accents included), inserted, deleted, or two neighbours swapped. */
export function oneEditWords(w: string): Set<string> {
  const out = new Set<string>();
  const add = (c: string) => {
    if (c !== w && c.length > 0 && isDictionaryWord(c)) out.add(c);
  };
  for (let i = 0; i <= w.length; i++) {
    for (const l of LETTERS) {
      add(w.slice(0, i) + l + w.slice(i)); // insertion
      if (i < w.length) add(w.slice(0, i) + l + w.slice(i + 1)); // substitution
    }
    if (i < w.length) add(w.slice(0, i) + w.slice(i + 1)); // deletion
    if (i < w.length - 1) add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // transposition
  }
  return out;
}

function oneEdit(rng: Pick, w: string): { wrong: string; kind: Misspelling['kind'] } {
  const accents = [...w].map((c, i) => ({ c, i })).filter(({ c }) => /[áéíóú]/.test(c));
  const kinds: Misspelling['kind'][] = ['substitution', 'insertion', 'deletion', 'transposition', 'accent'];
  const kind = rng.pick(kinds);
  const i = rng.int(w.length);
  const l = rng.pick([...LETTERS]);
  switch (kind) {
    case 'substitution':
      return { wrong: w.slice(0, i) + l + w.slice(i + 1), kind };
    case 'insertion':
      return { wrong: w.slice(0, i) + l + w.slice(i), kind };
    case 'deletion':
      return { wrong: w.slice(0, i) + w.slice(i + 1), kind };
    case 'transposition':
      return { wrong: i < w.length - 1 ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) : w, kind };
    default: {
      if (accents.length) {
        const a = rng.pick(accents);
        return { wrong: w.slice(0, a.i) + stripAcuteAccents(a.c) + w.slice(a.i + 1), kind };
      }
      // an accent where the word has none: a vowel given an acute accent
      const vowels = [...w].map((c, j) => ({ c, j })).filter(({ c }) => /[aeiou]/.test(c));
      if (!vowels.length) return { wrong: w, kind };
      const v = rng.pick(vowels);
      const acute = ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' } as Record<string, string>)[v.c];
      return { wrong: w.slice(0, v.j) + acute + w.slice(v.j + 1), kind };
    }
  }
}

function sampleStems(rng: Pick, min: number, max: number): string[] {
  const pool = dictionaryStems().filter((w) => w.length >= min && w.length <= max);
  if (pool.length < 1000) throw new Error(`setup: the dictionary offers only ${pool.length} stems of ${min}–${max} letters`);
  return pool;
}

/**
 * `n` one-letter or accent errors whose ONLY dictionary word one edit away is the word they were made
 * from — so that word is, by the dictionary alone, the expected correction (ROW-021's "expected
 * correction"). Made from stems of 7–12 letters (no short word a monosyllable rule could touch), all
 * `mustBeFlagged`, all different, and no two sharing an intended word. `kinds` limits the edits.
 */
export function uniqueCorrectionErrors(rng: Pick, n: number, kinds?: readonly Misspelling['kind'][]): Misspelling[] {
  const pool = sampleStems(rng, 7, 12);
  const out: Misspelling[] = [];
  const used = new Set<string>();
  for (let tries = 0; out.length < n; tries++) {
    if (tries > 200_000) throw new Error(`setup: only ${out.length} of ${n} unique-correction misspellings found`);
    const intended = rng.pick(pool);
    if (used.has(intended)) continue;
    const { wrong, kind } = oneEdit(rng, intended);
    if (kinds && !kinds.includes(kind)) continue;
    if (wrong === intended || used.has(wrong) || !mustBeFlagged(wrong)) continue;
    const near = oneEditWords(wrong);
    if (near.size !== 1 || !near.has(intended)) continue;
    used.add(intended).add(wrong);
    out.push({ intended, wrong, kind });
  }
  return out;
}

/**
 * `n` one-letter or accent errors with at least `atLeast` (default 6) dictionary words one edit away —
 * misspellings for which more than 5 suggestions plausibly exist, so a list cut to 5 is a real cut.
 * Made from stems of 5–8 letters, all `mustBeFlagged`, all different.
 */
export function crowdedErrors(rng: Pick, n: number, atLeast = 6): Misspelling[] {
  const pool = sampleStems(rng, 5, 8);
  const out: Misspelling[] = [];
  const used = new Set<string>();
  for (let tries = 0; out.length < n; tries++) {
    if (tries > 200_000) throw new Error(`setup: only ${out.length} of ${n} crowded misspellings found`);
    const intended = rng.pick(pool);
    const { wrong, kind } = oneEdit(rng, intended);
    if (wrong === intended || used.has(wrong) || !mustBeFlagged(wrong)) continue;
    if (oneEditWords(wrong).size < atLeast) continue;
    used.add(wrong);
    out.push({ intended, wrong, kind });
  }
  return out;
}

// The sound-alike swaps of each class, as [pattern, replacement] at one position of the word.
const SWAPS: Record<SoundClass, [RegExp, string][]> = {
  'b-v': [[/b/g, 'v'], [/v/g, 'b']],
  'll-y': [[/ll/g, 'y'], [/y(?=[aeiouáéíóú])/g, 'll']],
  's-c-z': [[/c(?=[eiéí])/g, 's'], [/c(?=[eiéí])/g, 'z'], [/z/g, 's'], [/s(?=[eiéí])/g, 'c'], [/s(?=[aouáóú])/g, 'z']],
  h: [[/(?<!c)h/g, '']],
  'g-j': [[/g(?=[eiéí])/g, 'j'], [/j(?=[eiéí])/g, 'g']],
};

function soundSwaps(w: string, cls: SoundClass): string[] {
  const out: string[] = [];
  for (const [re, rep] of SWAPS[cls]) {
    for (const m of w.matchAll(re)) {
      const at = m.index ?? 0;
      out.push(w.slice(0, at) + rep + w.slice(at + m[0].length));
    }
  }
  return out;
}

/** Every dictionary word one sound-alike swap (of any class) away from `w`. */
export function soundAlikeWords(w: string): Set<string> {
  const out = new Set<string>();
  for (const cls of SOUND_CLASSES) for (const c of soundSwaps(w, cls)) if (c !== w && isDictionaryWord(c)) out.add(c);
  return out;
}

/**
 * `perClass` sound-alike confusions of each class (b/v, ll/y, s/c/z, a dropped h, g/j), made from
 * stems of 6–12 letters: `wrong` is one swap of the class away from `intended`, `mustBeFlagged`, and
 * the dictionary words within one edit or one sound-alike swap of `wrong` number at most 5 — so the
 * intended word has room among 5 suggestions by the dictionary alone.
 */
export function soundAlikeErrors(rng: Pick, perClass: number): Misspelling[] {
  const pool = sampleStems(rng, 6, 12);
  const out: Misspelling[] = [];
  const used = new Set<string>();
  for (const cls of SOUND_CLASSES) {
    const candidates = pool.filter((w) => soundSwaps(w, cls).length > 0);
    let got = 0;
    for (let tries = 0; got < perClass; tries++) {
      if (tries > 100_000) throw new Error(`setup: only ${got} of ${perClass} sound-alike misspellings of class ${cls} found`);
      const intended = rng.pick(candidates);
      if (used.has(intended)) continue;
      const wrong = rng.pick(soundSwaps(intended, cls));
      if (used.has(wrong) || !mustBeFlagged(wrong)) continue;
      const near = new Set([...oneEditWords(wrong), ...soundAlikeWords(wrong)]);
      if (!near.has(intended) || near.size > 5) continue;
      used.add(intended).add(wrong);
      out.push({ intended, wrong, kind: cls });
      got++;
    }
  }
  return out;
}

/**
 * The independent list of Spanish vulgar or offensive words ROW-133 names, written by this pass from
 * general knowledge of Spanish, never taken from the product: sexual and scatological vulgarities,
 * insults and slurs, with their common inflections. Left out on purpose: words whose everyday sense is
 * not offensive and that a job offer may well need (zorra "fox", concha "shell", pija, culo, capullo
 * "bud", hostia "host", verga "yard", teta, ano), so the list never asks the product to withhold a
 * legitimate correction.
 */
export const OFFENSIVE_WORDS: readonly string[] = [
  'mierda', 'mierdas', 'puta', 'putas', 'puto', 'putos', 'putada', 'putadas', 'hijoputa', 'joder', 'jodido',
  'jodida', 'jodidos', 'jodidas', 'coño', 'coñazo', 'cabrón', 'cabrona', 'cabrones', 'cabronas', 'gilipollas',
  'gilipollez', 'polla', 'pollas', 'follar', 'follada', 'follado', 'folladas', 'follados', 'maricón', 'maricona',
  'maricones', 'marica', 'maricas', 'bollera', 'bolleras', 'tortillera', 'pendejo', 'pendeja', 'pendejos',
  'chocho', 'chochos', 'ojete', 'cojones', 'cojón', 'mamón', 'mamona', 'mamones', 'imbécil', 'imbéciles',
  'subnormal', 'subnormales', 'idiota', 'idiotas', 'sudaca', 'sudacas', 'negrata', 'mongolo', 'mongola',
  'zorrón', 'putero', 'puteros', 'cagar', 'cagada', 'cagado', 'mear', 'meada', 'pajillero', 'pajero', 'cipote',
  'mariconada', 'malparido', 'malparida', 'hijueputa', 'carajo', 'concha de tu madre',
];

const OFFENSIVE = new Set(OFFENSIVE_WORDS.map((w) => w.toLowerCase()));

/** True when `s`, lower-cased, is on the offensive list (whole suggestion, or any of its words). */
export function isOffensive(s: string): boolean {
  const lower = s.toLowerCase().trim();
  return OFFENSIVE.has(lower) || lower.split(/\s+/).some((w) => OFFENSIVE.has(w));
}

/**
 * `n` misspellings each one edit from a dictionary word on the offensive list (so a product that
 * ranks by the dictionary alone would suggest that word): `intended` is the offensive word the
 * misspelling sits next to, `wrong` is `mustBeFlagged`. All different.
 */
export function nearOffensiveErrors(rng: Pick, n: number): Misspelling[] {
  const pool = OFFENSIVE_WORDS.filter((w) => LOWER_WORD.test(w) && w.length >= 4 && isDictionaryWord(w));
  if (pool.length < 10) throw new Error(`setup: the dictionary holds only ${pool.length} of the offensive words`);
  const out: Misspelling[] = [];
  const used = new Set<string>();
  for (let tries = 0; out.length < n; tries++) {
    if (tries > 100_000) throw new Error(`setup: only ${out.length} of ${n} near-offensive misspellings found`);
    const intended = rng.pick(pool);
    const i = rng.int(intended.length);
    const wrong = intended.slice(0, i) + rng.pick([...LETTERS]) + intended.slice(i + 1);
    if (wrong === intended || used.has(wrong) || used.has(intended) || !mustBeFlagged(wrong)) continue;
    used.add(wrong).add(intended);
    out.push({ intended, wrong, kind: 'substitution' });
  }
  return out;
}
