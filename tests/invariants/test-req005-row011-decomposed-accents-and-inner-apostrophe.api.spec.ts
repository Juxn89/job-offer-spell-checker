// Purpose: ROW-011 (REQ-005) — through the check endpoint, correct words pasted with decomposed accents
// (NFD) are not flagged, misspellings among them are flagged at their offsets in the text as sent, and a
// word with an inner apostrophe is checked as one word.
// Provenance: generated from the dictionary oracle's accent population and hand-authored ñ/ü words
// (each checked against the oracle), decomposed with String.prototype.normalize('NFD'); misspellings
// fresh per run; no expected value comes from the product.
//
// Test argument
// ROW-011 promise: a correct word pasted with decomposed accents is not flagged, and a word with an
//   inner apostrophe is checked as one word (REQ-005 "decomposed accents are normalised to composed
//   letters before lookup", "a word keeps an inner apostrophe", fail-if arm 4; A-017), with flags
//   placed in the text exactly as sent (D-020: UTF-16 offsets, word = text.slice(start, end)).
// ROW-011 wrong product: one that looks up "gestión" as sent and flags every decomposed word
//   (or splits it at the combining mark, flagging "gestio" and "n"); one that normalises the text and
//   then reports offsets into the normalised copy, so every flag after the first decomposed word lands
//   short of its word; one that drops combining marks, turning "año" into "ano" (flagged by REQ-044);
//   and one that cuts "zqrt'vbn" at the apostrophe into two flags.
// ROW-011 given: ~120 dictionary words with acute accents, ñ or ü, all decomposed (some title-cased
//   at sentence starts), with fresh misspellings that carry a decomposed accent placed after them,
//   and fresh non-words joined by an inner ' or ’; when: POST /api/check; then: exactly the fresh
//   misspellings are flagged, each at its offsets in the decomposed text, each apostrophe word as ONE
//   flag spanning both sides and the apostrophe.
// ROW-011 controls: the same kinds of misspelling in a composed (NFC) text are flagged at their
//   offsets — the endpoint flags them, so the target's verdict is about the decomposition and the
//   apostrophe.
// ROW-011 technique: a property over a fresh sample of the dictionary's accented words, decomposed;
//   the offsets are the test's own record of the decomposed text, so a normalise-then-report product
//   fails on position, not only on membership; exact comparison.
// cases: ROW-011 target=ROW-011-decomposed-correct-words-not-flagged-and-apostrophe-words-flagged-as-one control=ROW-011-control-composed-misspellings-flagged-at-their-offsets

import { test } from '@playwright/test';
import { accentPopulation, asActor, freshNonWord, freshRandom, isDictionaryWord, type Rng } from './harness';
import { Offer, expectExact, fillers, requireDictionary, titleCase } from './names-terms-helpers';

// Words with ñ or ü (decomposed into n + U+0303 and u + U+0308), checked against the oracle on use.
const TILDE_DIAERESIS = ['año', 'años', 'diseño', 'compañía', 'señor', 'español', 'enseñanza', 'pequeño', 'mañana', 'pingüino', 'bilingüe', 'vergüenza', 'lingüística'];

/** A fresh misspelling carrying an acute accent: consonants around one accented vowel, no dictionary word. */
function accentedNonWord(rng: Rng): string {
  for (;;) {
    const w = freshNonWord(rng).slice(0, 4) + rng.pick(['á', 'é', 'í', 'ó', 'ú']) + freshNonWord(rng).slice(0, 4);
    if (!isDictionaryWord(w)) return w;
  }
}

const nfd = (s: string) => s.normalize('NFD');

test('ROW-011-decomposed-correct-words-not-flagged-and-apostrophe-words-flagged-as-one', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireDictionary(TILDE_DIAERESIS, 'ROW-011 ñ/ü words');
  const words = rng.shuffle([...rng.shuffle(accentPopulation()).slice(0, 100).map((p) => p.word), ...TILDE_DIAERESIS]);
  const o = new Offer().put(nfd(fillers(rng, 2, { capital: true })) + ' ');
  words.forEach((w, i) => {
    const start = i % 15 === 0;
    if (start) o.put('. ');
    const shown = start ? titleCase(w) : w;
    if (nfd(shown) === shown) throw new Error(`setup: ${shown} does not decompose`);
    o.keep(nfd(shown), `decomposed correct word ${shown}`);
    o.put(i % 7 === 3 ? ', ' : ' ');
    if (i % 12 === 5) o.flag(nfd(accentedNonWord(rng)), 'decomposed misspelling').put(' ');
  });
  o.put(fillers(rng, 1) + ' ').flag(`${freshNonWord(rng)}'${freshNonWord(rng)}`, "non-word with an inner ' (one word)");
  o.put(' ' + fillers(rng, 1) + ' ').flag(`${freshNonWord(rng)}’${freshNonWord(rng)}`, 'non-word with an inner ’ (one word)');
  o.put(' ' + fillers(rng, 1) + ' ').flag(nfd(`${accentedNonWord(rng)}'${freshNonWord(rng)}`), "decomposed non-word with an inner ' (one word)");
  o.put(' ' + fillers(rng, 2));
  if (o.expected.length < 10) throw new Error('setup: too few misspellings placed among the decomposed words');
  await expectExact(o, `ROW-011: decomposed correct words (seed ${rng.seed}) are not flagged, misspellings are flagged at their offsets in the text as sent, and an inner-apostrophe word is one flag`);
});

test('ROW-011-control-composed-misspellings-flagged-at-their-offsets', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }) + ' ');
  for (let i = 0; i < 3; i++) o.put(fillers(rng, 2) + ' ').flag(accentedNonWord(rng), 'composed misspelling').put(' ');
  o.put(fillers(rng, 1) + ' ').flag(freshNonWord(rng), 'non-word').put(' ' + fillers(rng, 2));
  await expectExact(o, `ROW-011 control: composed misspellings are flagged at their offsets (seed ${rng.seed})`);
});
