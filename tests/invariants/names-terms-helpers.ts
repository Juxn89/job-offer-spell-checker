// Purpose: shared setup for the names-terms batch (REQ-005 to REQ-009, REQ-035, REQ-041 rows) — fresh
// names and mixed-case words, an offer builder that records where every word stands, the exact-flag
// comparison through the check endpoint, accent restoration over the dictionary oracle, and a Spanish
// verb-form generator built from conjugation rules (independent of the product's dictionary).
// Provenance: hand-authored by the test-author pass (slice skeleton, batch names-terms); every expected
// value is computed here from the test's own record of the text it built, the dictionary oracle
// (tests/invariants/spanish-dictionary.ts via the harness) or Spanish morphology written out below —
// never from the product's answer or its code.
//
// Contract: a public harness boundary for the names-terms tests. Nothing here sends a check except
// `checkOffer`, which goes through the harness's API door (and so through the shared check budget).

import { expect } from '@playwright/test';
import {
  checkText,
  fillerWords,
  hasInclusiveReading,
  isDictionaryWord,
  type CheckAnswer,
  type Flag,
  type Rng,
} from './harness';

const MAX_TEXT = 9_000; // below REQ-021's 10,000-character limit, so no text is refused for length

// ─── Letters and accents ─────────────────────────────────────────────────────────────────────────

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' };
const PLAIN: Record<string, string> = Object.fromEntries(Object.entries(ACUTE).map(([k, v]) => [v, k]));

/** `word` with every acute accent removed, upper and lower case (á→a, Ó→O); ñ and ü untouched. */
export function stripAcute(word: string): string {
  return word.replace(/[áéíóúÁÉÍÓÚ]/g, (c) => PLAIN[c]);
}

/** First letter upper case (Spanish locale), the rest as given. */
export function titleCase(word: string): string {
  return word.charAt(0).toLocaleUpperCase('es') + word.slice(1);
}

/**
 * Every form of `word` with one acute accent added on one of its vowels that the dictionary oracle
 * holds, exactly as cased ("Tecnicos" → ["Técnicos"]). Empty for a word that already carries an acute
 * accent. This is REQ-009's "the same word with its accents restored", read from the dictionary.
 */
export function accentRestorations(word: string): string[] {
  if (/[áéíóúÁÉÍÓÚ]/.test(word)) return [];
  const out: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const a = ACUTE[word[i]];
    if (!a) continue;
    const cand = word.slice(0, i) + a + word.slice(i + 1);
    if (isDictionaryWord(cand)) out.push(cand);
  }
  return out;
}

// ─── Fresh names ─────────────────────────────────────────────────────────────────────────────────

const ONSETS = ['b', 'd', 'f', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CODAS = ['n', 'r', 'l', 'z', 'd'];

/** True when no ratified rule could make `word` (in any of the casings given) a known word. */
function unknownEverywhere(forms: string[]): boolean {
  return forms.every((f) => !isDictionaryWord(f) && accentRestorations(f).length === 0);
}

/**
 * A fresh proper name: four consonant-vowel syllables and a final consonant, title case ("Bavelotin"),
 * unique per run. Guaranteed by the dictionary oracle: neither it nor its lower-case form is a
 * dictionary word, no accent restoration of either is one, and it has no inclusive reading — so by
 * REQ-009 it is a name in mid-sentence (not flagged) and a misspelling at a sentence start (flagged).
 * It has no capital after its first letter (REQ-041 does not apply).
 */
export function freshName(rng: Rng): string {
  for (;;) {
    let w = '';
    for (let i = 0; i < 4; i++) w += rng.pick(ONSETS) + rng.pick(VOWELS);
    w += rng.pick(CODAS);
    const t = titleCase(w);
    if (unknownEverywhere([w, t]) && !hasInclusiveReading(w)) return t;
  }
}

/**
 * A fresh mixed-case word in the shape REQ-041 names (LinkedIn, iOS): a fresh name with one capital
 * letter after its first two letters and lower-case letters around it, its first letter upper or lower
 * case at random ("baveLotin", "BaveLotin"). Not a dictionary word in any of its casings.
 */
export function freshMixedCase(rng: Rng): string {
  for (;;) {
    const base = freshName(rng).toLowerCase();
    const i = 2 + rng.int(base.length - 4); // a capital strictly inside, lower-case letters after it
    let w = base.slice(0, i) + base[i].toUpperCase() + base.slice(i + 1);
    if (rng.int(2) === 0) w = titleCase(w);
    if (/[A-Z]/.test(w.slice(1)) && /[a-z]/.test(w) && w !== w.toUpperCase() && !isDictionaryWord(w)) return w;
  }
}

/** Fresh lower-case letters only (a fresh name's letters), for building addresses and handles. */
export function freshLetters(rng: Rng): string {
  return freshName(rng).toLowerCase();
}

/** A few correct filler words, joined by spaces; `capital` title-cases the first (a sentence opening). */
export function fillers(rng: Rng, n: number, opts: { capital?: boolean } = {}): string {
  const pool = fillerWords();
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(rng.pick(pool));
  if (opts.capital && words.length) words[0] = titleCase(words[0]);
  return words.join(' ');
}

/** Fails `setup:` unless the oracle holds every word given exactly as written. */
export function requireDictionary(words: readonly string[], why: string): void {
  const missing = words.filter((w) => !isDictionaryWord(w));
  if (missing.length) throw new Error(`setup: ${why}: the dictionary oracle does not hold ${missing.join(', ')}`);
}

/** Fails `setup:` when the oracle holds any word given exactly as written. */
export function requireNotDictionary(words: readonly string[], why: string): void {
  const held = words.filter((w) => isDictionaryWord(w));
  if (held.length) throw new Error(`setup: ${why}: the dictionary oracle holds ${held.join(', ')}`);
}

// ─── The offer builder and the exact-flag comparison ─────────────────────────────────────────────

/** A word the product must flag: where it starts, and every end the row accepts for its flag. */
export type Expected = { start: number; word: string; ends: number[]; label: string };
/** A word the product must not flag, recorded so a flag on it is reported by name. */
export type Kept = { start: number; end: number; word: string; label: string };

/**
 * Builds an offer's text piece by piece, recording — before anything is sent — where each word the
 * test cares about stands (UTF-16 offsets, end exclusive, as D-020 reports them).
 */
export class Offer {
  text = '';
  readonly expected: Expected[] = [];
  readonly kept: Kept[] = [];

  /** Appends text the test makes no claim about word by word (correct fillers, punctuation). */
  put(s: string): this {
    this.text += s;
    return this;
  }

  /**
   * Appends `word`, which must be flagged. Its flag must start where `word` starts and end where it
   * ends — or, when `altEnd` is given, at `altEnd` characters into it instead (an inclusive form
   * whose flag may cover the misspelled base alone).
   */
  flag(word: string, label: string, altEnd?: number): this {
    const start = this.text.length;
    const ends = [start + word.length];
    if (altEnd !== undefined && altEnd !== word.length) ends.push(start + altEnd);
    this.expected.push({ start, word, ends, label });
    this.text += word;
    return this;
  }

  /** Appends `word`, which must not be flagged (nor any part of it). */
  keep(word: string, label: string): this {
    this.kept.push({ start: this.text.length, end: this.text.length + word.length, word, label });
    this.text += word;
    return this;
  }

  get length(): number {
    return this.text.length;
  }
}

/** The outcome of one exact comparison, plus the flags matched to each expected word. */
export type Comparison = {
  answer: CheckAnswer;
  matched: { expected: Expected; flag: Flag }[];
  report: { missing: string[]; unexpected: string[] };
};

const around = (text: string, start: number, end: number) =>
  JSON.stringify(text.slice(Math.max(0, start - 20), start) + '⟦' + text.slice(start, end) + '⟧' + text.slice(end, end + 20));

/**
 * Sends the offer through the API door (POST /api/check) and compares the flags with the offer's
 * record EXACTLY: every expected word flagged once at its own place (start, and one of its accepted
 * ends, and word = text.slice(start, end) as D-020 says), and no other flag anywhere — a flag on a
 * kept word is reported by that word's label. Returns the comparison; it asserts nothing itself
 * (`expectExact` does).
 */
export async function compareOffer(offer: Offer): Promise<Comparison> {
  const { text } = offer;
  if (text.length > MAX_TEXT) throw new Error(`setup: an offer of ${text.length} characters is over the batch's ${MAX_TEXT}-character page size`);
  const answer = await checkText(text);
  const open = new Set(offer.expected.map((_, i) => i));
  const matched: Comparison['matched'] = [];
  const unexpected: string[] = [];
  for (const f of answer.flagged) {
    const sliceOk = f.word === text.slice(f.start, f.end);
    let hit = -1;
    if (sliceOk) {
      for (const i of open) {
        const e = offer.expected[i];
        if (e.start === f.start && e.ends.includes(f.end)) {
          hit = i;
          break;
        }
      }
    }
    if (hit >= 0) {
      open.delete(hit);
      matched.push({ expected: offer.expected[hit], flag: f });
      continue;
    }
    const onKept = offer.kept.filter((k) => f.start < k.end && f.end > k.start).map((k) => `${k.label} ${JSON.stringify(k.word)}`);
    unexpected.push(
      `${JSON.stringify(f.word)} at ${f.start}-${f.end} ${around(text, f.start, f.end)}` +
        (sliceOk ? '' : ' (its word is not the text at its offsets)') +
        (onKept.length ? ` — on ${onKept.join(', ')}` : ''),
    );
  }
  const missing = [...open].map((i) => {
    const e = offer.expected[i];
    return `${e.label} ${JSON.stringify(e.word)} at ${e.start}-${e.ends.join('|')} ${around(text, e.start, e.ends[0])}`;
  });
  return { answer, matched, report: { missing, unexpected } };
}

/**
 * `compareOffer` plus the assertion: nothing missing, nothing unexpected. `what` names the row and the
 * promise, and is the assertion's message (the row id first, so a failure names the row).
 */
export async function expectExact(offer: Offer, what: string): Promise<Comparison> {
  const c = await compareOffer(offer);
  const cut = (xs: string[]) => ({ count: xs.length, first: xs.slice(0, 30) });
  expect(
    { notFlagged: cut(c.report.missing), flaggedButShouldNotBe: cut(c.report.unexpected) },
    `${what} — in a ${offer.text.length}-character text with ${offer.expected.length} words to flag and ${offer.kept.length} not to`,
  ).toEqual({ notFlagged: { count: 0, first: [] }, flaggedButShouldNotBe: { count: 0, first: [] } });
  return c;
}

/**
 * Lays items out over as many offers as the page size needs: `render` appends one item to the offer
 * it is handed. Each offer is opened with `open` (a heading, a first sentence) when given.
 */
export function paginate<T>(items: readonly T[], render: (o: Offer, item: T, i: number) => void, open?: (o: Offer) => void, size = 8_000): Offer[] {
  const offers: Offer[] = [];
  let o = new Offer();
  open?.(o);
  items.forEach((item, i) => {
    if (o.length > size) {
      offers.push(o);
      o = new Offer();
      open?.(o);
    }
    render(o, item, i);
  });
  offers.push(o);
  return offers;
}

// ─── Verb forms, from Spanish conjugation rules (not from any dictionary) ────────────────────────

type Theme = 'ar' | 'er' | 'ir';

// Regular endings by theme vowel. Persons: yo, tú, él/usted, nosotros, vosotros, ellos/ustedes.
const ENDINGS: Record<Theme, Record<string, string[]>> = {
  ar: {
    presente: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    preterito: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    imperfecto: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    futuro: ['aré', 'arás', 'ará', 'aremos', 'aréis', 'arán'],
    condicional: ['aría', 'arías', 'aría', 'aríamos', 'aríais', 'arían'],
    subjPresente: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    subjImperfectoRa: ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'],
    subjImperfectoSe: ['ase', 'ases', 'ase', 'ásemos', 'aseis', 'asen'],
    subjFuturo: ['are', 'ares', 'are', 'áremos', 'areis', 'aren'],
  },
  er: {
    presente: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    preterito: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    imperfecto: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    futuro: ['eré', 'erás', 'erá', 'eremos', 'eréis', 'erán'],
    condicional: ['ería', 'erías', 'ería', 'eríamos', 'eríais', 'erían'],
    subjPresente: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    subjImperfectoRa: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
    subjImperfectoSe: ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'],
    subjFuturo: ['iere', 'ieres', 'iere', 'iéremos', 'iereis', 'ieren'],
  },
  ir: {
    presente: ['o', 'es', 'e', 'imos', 'ís', 'en'],
    preterito: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    imperfecto: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    futuro: ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
    condicional: ['iría', 'irías', 'iría', 'iríamos', 'iríais', 'irían'],
    subjPresente: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    subjImperfectoRa: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
    subjImperfectoSe: ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'],
    subjFuturo: ['iere', 'ieres', 'iere', 'iéremos', 'iereis', 'ieren'],
  },
};

const VOSEO_PRESENTE: Record<Theme, string> = { ar: 'ás', er: 'és', ir: 'ís' };
const VOSEO_IMPERATIVO: Record<Theme, string> = { ar: 'á', er: 'é', ir: 'í' };
const VOSOTROS_IMPERATIVO: Record<Theme, string> = { ar: 'ad', er: 'ed', ir: 'id' };
const TU_IMPERATIVO: Record<Theme, string> = { ar: 'a', er: 'e', ir: 'e' };
const GERUNDIO: Record<Theme, string> = { ar: 'ando', er: 'iendo', ir: 'iendo' };
const PARTICIPIO: Record<Theme, string> = { ar: 'ado', er: 'ido', ir: 'ido' };

function themeOf(infinitive: string): Theme {
  const t = infinitive.slice(-2);
  if (t !== 'ar' && t !== 'er' && t !== 'ir') throw new Error(`setup: ${infinitive} is no infinitive`);
  return t;
}

/**
 * The spelling of `stem + ending` under Spanish orthography for -ar verbs: before e/é, c becomes qu
 * (busqué), g becomes gu (entregué) and z becomes c (analicé).
 */
function join(stem: string, ending: string, theme: Theme): string {
  if (theme === 'ar' && /^[eé]/.test(ending)) {
    if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu' + ending;
    if (stem.endsWith('g')) return stem.slice(0, -1) + 'gu' + ending;
    if (stem.endsWith('z')) return stem.slice(0, -1) + 'c' + ending;
  }
  return stem + ending;
}

/**
 * The full simple conjugation of a regular Spanish verb (with the -ar spelling changes, and the -zc-
 * of verbs in -ecer/-ocer such as ofrecer): infinitive, gerund, the participle in its four gender and
 * number forms, every person of the indicative (present, preterite, imperfect, future, conditional)
 * and subjunctive (present, both imperfects, future) tenses, the imperative (tú, vosotros; usted and
 * ustedes are the subjunctive's), and the voseo forms of the present indicative and the imperative
 * (trabajás, trabajá). Distinct forms, in that order.
 */
export function regularConjugation(infinitive: string): string[] {
  const theme = themeOf(infinitive);
  const stem = infinitive.slice(0, -2);
  const zc = /[eo]cer$/.test(infinitive) ? stem.slice(0, -1) + 'zc' : null;
  const e = ENDINGS[theme];
  const forms: string[] = [infinitive, join(stem, GERUNDIO[theme], theme)];
  for (const g of ['', 'a', 's', 'as']) {
    const p = PARTICIPIO[theme];
    forms.push(stem + (g === '' ? p : g === 's' ? p + 's' : p.slice(0, -1) + g));
  }
  for (const [tense, ends] of Object.entries(e)) {
    ends.forEach((end, person) => {
      if (zc && tense === 'presente' && person === 0) forms.push(zc + 'o');
      else if (zc && tense === 'subjPresente') forms.push(zc + end);
      else forms.push(join(stem, end, theme));
    });
  }
  forms.push(join(stem, VOSEO_PRESENTE[theme], theme));
  forms.push(stem + TU_IMPERATIVO[theme], stem + VOSEO_IMPERATIVO[theme], stem + VOSOTROS_IMPERATIVO[theme]);
  return [...new Set(forms)];
}

const isVowel = (c: string | undefined) => !!c && /[aeiouáéíóú]/.test(c);

/**
 * `stem` with an acute accent on its last vowel — the stressed vowel of a regular imperative or
 * subjunctive whose stress falls on the stem (postul-a → postúl-). Fails `setup:` when that vowel
 * stands beside another vowel (a diphthong, where the rule would need more care) or the stem has none.
 */
function accentLastStemVowel(stem: string): string {
  for (let i = stem.length - 1; i >= 0; i--) {
    if (!isVowel(stem[i])) continue;
    if (/[áéíóú]/.test(stem)) return stem; // already written with its accent (enví-)
    if (isVowel(stem[i - 1]) && !(stem[i - 1] === 'u' && /[qg]/.test(stem[i - 2] ?? ''))) {
      throw new Error(`setup: ${stem}'s last vowel stands in a diphthong; the enclitic generator does not accent it`);
    }
    if (stem[i] === 'u' && /[qg]/.test(stem[i - 1] ?? '')) continue; // the silent u of qu/gu
    return stem.slice(0, i) + ACUTE[stem[i]] + stem.slice(i + 1);
  }
  throw new Error(`setup: ${stem} has no vowel`);
}

/** The clitic sets a verb takes in the generated sample: reflexive (te, se) or object (nos). */
export type CliticSet = 'reflexive' | 'object';

/**
 * Enclitic forms of a regular verb, written by the RAE's accent rules (the word becomes esdrújula or
 * keeps llana stress): tú imperative + clitic (postúlate, contáctanos), voseo imperative + clitic
 * (postulate, contactanos — the voseo accent drops), usted imperative + clitic (postúlese,
 * contáctenos, búsquenos), infinitive + clitic (postularte, contactarnos) and gerund + clitic
 * (postulándote, escribiéndonos). Reflexive verbs take te and se; object verbs take nos.
 */
export function encliticForms(infinitive: string, set: CliticSet): string[] {
  const theme = themeOf(infinitive);
  const stem = infinitive.slice(0, -2);
  const stressed = accentLastStemVowel(stem);
  const tu = stressed + TU_IMPERATIVO[theme];
  const vos = stem + TU_IMPERATIVO[theme].replace('e', theme === 'ir' ? 'i' : 'e');
  const usted = join(stressed, theme === 'ar' ? 'e' : 'a', theme);
  const gerund = stem + GERUNDIO[theme].replace(/^a/, 'á').replace(/^ie/, 'ié');
  const out: string[] = [];
  if (set === 'reflexive') {
    out.push(tu + 'te', vos + 'te', usted + 'se', infinitive + 'te', infinitive + 'se', gerund + 'te');
  } else {
    out.push(tu + 'nos', vos + 'nos', usted + 'nos', infinitive + 'nos', gerund + 'nos');
  }
  return out;
}
