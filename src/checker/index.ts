// Purpose: the spelling engine's one public surface (`@revisor/checker`): check(text) returns the
// flagged words of a Spanish job offer with their positions and suggestions. Pure function of the
// text, no I/O beyond reading the vendored dictionary once (REQ-029); nothing of a text outlives its
// check (REQ-018: no cache across checks).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import nspell from 'nspell';
import { ABBREVIATIONS, TERMS, TITLES } from './terms.js';

/** One flagged word: offsets are UTF-16 code-unit indices into the checked text (D-020). */
export interface Flag {
  start: number;
  end: number;
  word: string;
  suggestions: string[];
}

export interface CheckResult {
  flagged: Flag[];
}

type Speller = ReturnType<typeof nspell>;
let speller: Speller | undefined;

/** Loads the vendored dictionary once; later calls are free. Returns the load time in ms. */
export function loadDictionary(): number {
  if (speller) return 0;
  const started = Date.now();
  const dir = fileURLToPath(new URL('./dictionary/', import.meta.url));
  speller = nspell(readFileSync(dir + 'es.aff.txt'), readFileSync(dir + 'es.dic.txt'));
  return Date.now() - started;
}

/** True once the dictionary is loaded. */
export function isReady(): boolean {
  return speller !== undefined;
}

const MAX_SUGGESTIONS = 5; // REQ-010
const SUGGEST_BUDGET_MS = 1500; // REQ-023: past this, a check's remaining flags carry no suggestion

// REQ-005: a word is a run of letters (decomposed accents and invisible joiners inside it included),
// digits riding along so that a word with a digit can be skipped whole (REQ-003), with any inner
// apostrophe kept (A-017). Hyphens, slashes and every other punctuation separate words.
const INVISIBLE = '\\u00AD\\u200B-\\u200D\\u2060\\uFEFF';
const PART = `[\\p{L}\\p{N}]\\p{M}*(?:[${INVISIBLE}]*[\\p{L}\\p{N}]\\p{M}*)*`;
const WORD = new RegExp(`${PART}(?:['’]${PART})*`, 'gu');
const INVISIBLE_RE = new RegExp(`[${INVISIBLE}]`, 'gu');

// REQ-007: spans never checked — e-mail and web addresses, bare domains, handles and hashtags.
const SKIPPED_SPANS: RegExp[] = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu,
  /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"«»]+/giu,
  /\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|es|net|org|io|mx|ar|co|cl|pe|ec|uy|ve|bo|py|cr|gt|hn|sv|ni|pa|do|cu|pr|info|biz|dev|app|gob|edu|eu|us|ai|tech|jobs)\b(?:\/[^\s<>"«»]*)?/giu,
  /(?<![\p{L}\p{N}@])[@#][\p{L}\p{N}_.]*[\p{L}\p{N}_]/gu,
];
// REQ-006: an inclusive form written with @ inside a word (l@s, candidat@s, tod@s).
const AT_FORM = /(?<![\p{L}\p{N}@.])(\p{L}+)@(\p{L}*)(?![\p{L}\p{N}@])/gu;

const strip = (w: string) => w.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
const lower = (w: string) => w.toLocaleLowerCase('es');
const isAllCaps = (w: string) => /\p{Lu}/u.test(w) && !/\p{Ll}/u.test(w);
const isCapitalised = (w: string) => /^\p{Lu}/u.test(w) && !isAllCaps(w);
// REQ-041: a capital after a lower-case letter (LinkedIn, WhatsApp, iPhone).
const hasInnerCapital = (w: string) => /\p{Ll}.*\p{Lu}/u.test(w) || /^\p{Ll}+\p{Lu}/u.test(w);

/** Applies the case shape of `model` to `word` (REQ-011: a replacement keeps its capital letter). */
function caseLike(model: string, word: string): string {
  if (isAllCaps(model) && model.length > 1) return word.toLocaleUpperCase('es');
  if (/^\p{Lu}/u.test(model)) return word.charAt(0).toLocaleUpperCase('es') + word.slice(1);
  return word;
}

/** REQ-004: the cased form of the term-list words that are not written in lower case. */
const CASED: ReadonlyMap<string, string> = new Map(
  ['JavaScript', 'TypeScript', 'Python', 'Excel', 'Scrum', 'Java', 'Kotlin', 'Swift', 'React', 'Angular', 'Docker',
   'Kubernetes', 'Linux', 'Windows', 'Android', 'Azure', 'PowerPoint', 'Outlook', 'Word', 'SharePoint', 'Teams',
   'Slack', 'Jira', 'Figma', 'Photoshop', 'Salesforce', 'WordPress', 'Shopify', 'LinkedIn', 'WhatsApp', 'Instagram',
   'Facebook', 'TikTok', 'YouTube', 'Google', 'Microsoft', 'Amazon', 'GitHub', 'GitLab', 'MySQL', 'PostgreSQL',
   'MongoDB', 'Oracle', 'Firebase', 'Node', 'Laravel', 'Django', 'Tableau', 'HubSpot', 'Zendesk', 'Canva']
    .map((t) => [t.toLowerCase(), t]),
);

/** Edit distance with adjacent swaps, stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Term-list words one slip away from `word` (two for long words), in their own case: Javscript → JavaScript. */
function termsNear(word: string): string[] {
  const w = lower(word);
  if (w.length < 4) return [];
  const max = w.length > 7 ? 2 : 1;
  const near: string[] = [];
  for (const t of TERMS) {
    if (t.length < 4 || t === w || distance(w, t, max) > max) continue;
    const cased = CASED.get(t);
    near.push(cased ?? caseLike(word, t));
  }
  return near;
}

interface Token {
  start: number;
  end: number;
  raw: string; // as written, invisible characters included
  word: string; // NFC, invisible characters removed: what is looked up
}

type Start = 'none' | 'sentence' | 'colon';

/** One check's working state; dropped when the check returns (nothing is cached across checks). */
class Run {
  private suggestions = new Map<string, string[]>();
  private spent = 0;

  constructor(private readonly sp: Speller, private readonly text: string) {}

  /** True when the dictionary, the term list or an accepted variant holds the word. */
  known(word: string): boolean {
    if (TERMS.has(lower(word))) return true;
    if (this.sp.correct(word)) return true;
    const ascii = word.replace(/’/g, "'");
    if (ascii !== word && this.sp.correct(ascii)) return true;
    return this.voseo(word) || this.inclusive(word);
  }

  /** REQ-008: voseo forms (tenés, trabajá, vivís) of a verb whose infinitive the dictionary holds. */
  private voseo(word: string): boolean {
    const w = lower(word);
    const infinitive = { á: 'ar', é: 'er', í: 'ir', a: 'ar', e: 'er', i: 'ir' } as const;
    const m = /^(\p{L}+?)([áéí])(s?)$/u.exec(w);
    if (m && m[1].length >= 2) return this.sp.correct(m[1] + infinitive[m[2] as 'á' | 'é' | 'í']);
    // The voseo imperative with a pronoun attached loses its accent: seguinos, decime, contame.
    const c = /^(\p{L}{2,}?)([aei])(me|te|se|nos|os|lo|la|los|las|le|les|melo|mela|selo|sela|noslo)$/u.exec(w);
    return !!c && this.sp.correct(c[1] + infinitive[c[2] as 'a' | 'e' | 'i']);
  }

  /** REQ-006: inclusive endings — todxs, niñx, todes — read as the o/a form of a correct word. */
  private inclusive(word: string): boolean {
    const w = lower(word);
    const x = /^(\p{L}{2,})x(s?)$/u.exec(w);
    if (x) return this.sp.correct(`${x[1]}o${x[2]}`) || this.sp.correct(`${x[1]}a${x[2]}`);
    const e = /^(\p{L}{2,})es$/u.exec(w);
    if (e) return this.sp.correct(`${e[1]}os`) && this.sp.correct(`${e[1]}as`);
    return false;
  }

  /** Suggestions for a flagged word: accent-only corrections first (REQ-010), at most 5, cased like the word. */
  suggest(word: string): string[] {
    const cached = this.suggestions.get(word);
    if (cached) return cached;
    let list: string[] = [];
    if (this.spent < SUGGEST_BUDGET_MS) {
      const t = Date.now();
      list = this.sp.suggest(word);
      this.spent += Date.now() - t;
    }
    const base = lower(strip(word));
    const accentOnly = list.filter((s) => lower(strip(s)) === base);
    const terms = termsNear(word);
    const ordered = [...new Set([...accentOnly, ...terms, ...list])].filter((s) => s !== word).slice(0, MAX_SUGGESTIONS);
    this.suggestions.set(word, ordered);
    return ordered;
  }

  /** A-036: the word with its accents restored is a dictionary word (Gestion → gestión). */
  accentRestorable(word: string): boolean {
    const base = lower(strip(word));
    return this.suggest(word).some((s) => lower(strip(s)) === base && s !== word);
  }

  /** REQ-035: where the word stands — first in a sentence or line, after a colon, or inside a sentence. */
  startOf(tok: Token): Start {
    const t = this.text;
    const lineStart = t.lastIndexOf('\n', tok.start - 1) + 1;
    const prefix = t.slice(lineStart, tok.start);
    const lead = `[\\s\\p{Pd}\\p{Ps}\\p{Pi}¿¡"'•·▪◦‣●○■□►▶✓✔➢➤*+>]*`;
    if (new RegExp(`^${lead}(?:(?:\\d{1,3}|\\p{L})[.)]${lead})?$`, 'u').test(prefix)) return 'sentence';
    let i = tok.start - 1;
    while (i >= 0 && /[\s\p{Ps}\p{Pi}¿¡"'«“‘]/u.test(t[i])) i--;
    if (i < 0) return 'sentence';
    const c = t[i];
    if (c === ':') return 'colon';
    if (c === '?' || c === '!' || c === '…') return 'sentence';
    if (c === '.') {
      // A period after a title abbreviation (Lic., Sr., Dr.) does not start a sentence.
      const before = /([\p{L}]+)$/u.exec(t.slice(Math.max(0, i - 12), i));
      if (before && TITLES.has(lower(before[1]))) return 'none';
      return 'sentence';
    }
    return 'none';
  }
}

function tokens(text: string): Token[] {
  const skipped: Array<[number, number]> = [];
  for (const re of SKIPPED_SPANS) for (const m of text.matchAll(re)) skipped.push([m.index, m.index + m[0].length]);
  const inSkipped = (s: number, e: number) => skipped.some(([a, b]) => s < b && e > a);

  const out: Token[] = [];
  for (const m of text.matchAll(AT_FORM)) {
    if (inSkipped(m.index, m.index + m[0].length)) continue;
    skipped.push([m.index, m.index + m[0].length]);
    out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], word: `${m[1]}o${m[2]}`.normalize('NFC') });
  }
  for (const m of text.matchAll(WORD)) {
    const start = m.index;
    const end = start + m[0].length;
    if (inSkipped(start, end)) continue;
    out.push({ start, end, raw: m[0], word: m[0].replace(INVISIBLE_RE, '').normalize('NFC') });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** REQ-001: flags every word of the offer the Spanish dictionary does not hold, under the word rules. */
export function check(text: string): CheckResult {
  loadDictionary();
  const run = new Run(speller as Speller, text);
  const toks = tokens(text);
  const flagged: Flag[] = [];
  const flag = (tok: Token, suggestions: string[]) =>
    flagged.push({ start: tok.start, end: tok.end, word: text.slice(tok.start, tok.end), suggestions });

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    const w = tok.word;
    const lw = lower(w);
    const next = toks[i + 1];
    const prev = toks[i - 1];

    // REQ-044, A-047: ano and anos are always flagged, año and años suggested first.
    if (lw === 'ano' || lw === 'anos') {
      const fix = lw === 'ano' ? 'año' : 'años';
      const rest = run.suggest(w).filter((s) => lower(s) !== fix);
      flag(tok, [caseLike(w, fix), ...rest].slice(0, MAX_SUGGESTIONS));
      continue;
    }
    // REQ-003: a word with a digit is never flagged.
    if (/\p{N}/u.test(w)) continue;
    // REQ-003: all-capital words of at most 5 letters (SQL, RRHH), and their plurals (ONGs, PCs).
    const letters = w.replace(/[^\p{L}]/gu, '');
    if (isAllCaps(w) && letters.length <= 5) continue;
    if (/^\p{Lu}{2,5}s$/u.test(w)) continue;
    // REQ-041: mixed case with a capital inside (LinkedIn, WhatsApp).
    if (!isAllCaps(w) && hasInnerCapital(w)) continue;
    // REQ-007, REQ-035: an abbreviation written with its period (Lic., Sr., etc.).
    if (text[tok.end] === '.' && (TITLES.has(lw) || ABBREVIATIONS.has(lw))) continue;
    // Q1 (owner, 2026-11-23): the Latin phrase "curriculum vitae" passes as the RAE writes it.
    if ((lw === 'curriculum' && next && lower(next.word) === 'vitae' && /^\s+$/.test(text.slice(tok.end, next.start))) ||
        (lw === 'vitae' && prev && /^curr[ií]culum$/.test(lower(prev.word)) && /^\s+$/.test(text.slice(prev.end, tok.start)))) continue;

    if (run.known(w)) continue;

    // REQ-009, REQ-035: a capitalised unknown word inside a sentence, or after a colon, is taken as a
    // name — unless it is a real word missing its accent (A-036). First words are always checked.
    if (isCapitalised(w)) {
      const where = run.startOf(tok);
      // A misspelt product or tool name (Javscript, Exel) is still flagged: it sits one slip from a term.
      if (where !== 'sentence' && !run.accentRestorable(w) && termsNear(w).length === 0) continue;
    }
    flag(tok, run.suggest(w));
  }
  return { flagged };
}
