// Purpose: the ledger's dictionary oracle — answers "does the Spanish dictionary hold this word?" for
// the rows whose expected result is the dictionary itself (REQ-001), independently of the product's
// checker code: it reads the dictionary data the BASELINE names (RLA-ES, `dictionary-es` 4.0.0) with
// the Hunspell reader the BASELINE names (nspell), and refuses to answer when that data is not
// byte-for-byte the ratified release.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch harness); its answers come
// from dictionary-es 4.0.0 as pinned below by SHA-256, never from the product's check.
//
// What it never does: it never imports or calls the product's checker (`@revisor/checker`), never
// applies the product's exemptions (term list, capitals, inclusive forms, names): it answers
// dictionary membership only, and the population helper below leaves out the words where a ratified
// exemption would make membership the wrong expectation, saying which and why.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/** The dictionary release the oracle answers for: BASELINE "Spelling engine", vendored per REQ-029. */
export const DICTIONARY_RELEASE = 'dictionary-es 4.0.0 (LibreOffice RLA-ES, general Spanish)';

// The files as vendored from dictionary-es 4.0.0 (index.aff, index.dic), byte for byte.
const PINNED = {
  aff: { file: 'es.aff.txt', sha256: '892039d59db11d747061b81c3a92a52d48ba0e055b5835af1943cbd3c2fba85b' },
  dic: { file: 'es.dic.txt', sha256: '907f786a8ceb3456722b20ad91dd4dbe99c5c16e45015ea63155e36f26b06d2c' },
} as const;

// The repository keeps the vendored copy here (the working tree is mounted at /app in the harness).
const DICTIONARY_DIR = fileURLToPath(new URL('../../src/checker/dictionary/', import.meta.url));

type Speller = { correct(word: string): boolean };
type SpellerFactory = (aff: Buffer, dic: Buffer) => Speller;

let loaded: { speller: Speller; stems: string[] } | undefined;

function load(): { speller: Speller; stems: string[] } {
  if (loaded) return loaded;
  const read = (which: 'aff' | 'dic'): Buffer => {
    const { file, sha256 } = PINNED[which];
    let bytes: Buffer;
    try {
      bytes = readFileSync(DICTIONARY_DIR + file);
    } catch (e) {
      throw new Error(`setup: the dictionary oracle cannot read ${DICTIONARY_DIR}${file} (${(e as Error).message}) — the ratified ${DICTIONARY_RELEASE} must be readable there`);
    }
    const got = createHash('sha256').update(bytes).digest('hex');
    if (got !== sha256) {
      throw new Error(`setup: ${file} is not ${DICTIONARY_RELEASE} as ratified (sha256 ${got}, expected ${sha256}) — the oracle answers only for the ratified dictionary; a changed dictionary is a law question, not a test input`);
    }
    return bytes;
  };
  const aff = read('aff');
  const dic = read('dic');
  const require = createRequire(import.meta.url);
  const nspell = require('nspell') as SpellerFactory;
  const speller = nspell(aff, dic);
  const stems = dic
    .toString('utf8')
    .split('\n')
    .slice(1)
    .map((line) => line.split('/')[0].trim())
    .filter((s) => s.length > 0);
  loaded = { speller, stems };
  return loaded;
}

/**
 * True when the ratified Spanish dictionary holds `word` exactly as written (Hunspell semantics, affix
 * forms included: "gestiones", "publicó"). Case-sensitive as Hunspell is. Never consults the product.
 */
export function isDictionaryWord(word: string): boolean {
  return load().speller.correct(word);
}

/** `word` with its acute accents removed (á é í ó ú → a e i o u); ñ and ü are left as they are. */
export function stripAcuteAccents(word: string): string {
  return word.replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] as string);
}

/**
 * True when `word` reads as an inclusive form REQ-006 tells the product to accept: an ending in e/es or
 * x/xs standing for o/a, os/as (todes, todxs) over a dictionary word. Used only to leave such words out
 * of a population whose expected result is "flagged".
 */
export function hasInclusiveReading(word: string): boolean {
  const bases: string[] = [];
  for (const [end, subs] of [
    ['es', ['os', 'as']],
    ['xs', ['os', 'as']],
    ['e', ['o', 'a']],
    ['x', ['o', 'a']],
  ] as const) {
    if (word.endsWith(end)) for (const s of subs) bases.push(word.slice(0, -end.length) + s);
  }
  return bases.some((b) => isDictionaryWord(b));
}

export type AccentPair = { word: string; stripped: string };

const populations = new Map<number, AccentPair[]>();

/**
 * The accent population (ROW-001's sample, generated from the dictionary): every lower-case dictionary
 * stem of at least `minLength` letters carrying an acute accent, paired with its accent-stripped form,
 * keeping only pairs whose stripped form the dictionary does NOT hold — so `word` must not be flagged
 * and `stripped` must be. Left out, and why:
 *  - stripped forms that are themselves dictionary words (esta/está, publico/publicó) — the row says so;
 *  - stripped forms with an inclusive reading (pure over puro, albanes over albanos) — REQ-006 accepts those;
 *  - words shorter than `minLength` (default 7): the dictionary still holds monosyllables the current
 *    RAE rules make errors (lió, guió, prión, criáis — all of 6 letters or fewer), which REQ-008 tells
 *    the product to flag, so "dictionary word" is not their expected result.
 * Ordered as the dictionary lists them; callers shuffle with their own fresh randomness.
 */
export function accentPopulation(minLength = 7): AccentPair[] {
  const cached = populations.get(minLength);
  if (cached) return [...cached];
  const { stems } = load();
  const seen = new Set<string>();
  const out: AccentPair[] = [];
  for (const word of stems) {
    if (seen.has(word)) continue;
    seen.add(word);
    if (word.length < minLength) continue;
    if (!/^[a-zñáéíóúü]+$/.test(word) || !/[áéíóú]/.test(word)) continue;
    if (!isDictionaryWord(word)) continue;
    const stripped = stripAcuteAccents(word);
    if (isDictionaryWord(stripped) || hasInclusiveReading(stripped)) continue;
    out.push({ word, stripped });
  }
  populations.set(minLength, out);
  return [...out];
}
