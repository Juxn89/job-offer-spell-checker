// Purpose: ROW-013 (REQ-007) — through the check endpoint, no part of a web address, an email address or
// an @handle is flagged, even when its parts look like misspellings, while the same misspellings outside
// an address are flagged.
// Provenance: hand-authored address shapes from REQ-007 and A-017; their parts are fresh letters per run
// (freshLetters: no dictionary word) and accent-stripped words checked against the dictionary oracle; no
// expected value comes from the product.
//
// Test argument
// ROW-013 promise: no part of a web address, an email address or an @handle is flagged, including one
//   with misspelling-like parts (REQ-007 fail-if arm 1; A-017 "URLs, email addresses, @handles ... are
//   skipped").
// ROW-013 wrong product: one that recognises only "http(s)://" addresses, so "www.gestion-tecnico.com"
//   and "tecnosoluciones.com/empleos" are split into words and "gestion", "tecnico", "com" flagged;
//   one that skips the host but checks the path or query ("/empleos/zqrtv"); one that splits an email
//   at "@" and "." and flags its parts; or one that skips every word near an address, so a real
//   misspelling right after it goes unflagged.
// ROW-013 given: https/http/www/bare-domain addresses with paths, queries and fragments, email
//   addresses and @handles, every part fresh letters or an accent-stripped word, set in sentences,
//   in brackets, before a comma or a final period; and, elsewhere in the same text, the accent-stripped
//   words and a fresh non-word standing alone; when: POST /api/check; then: the flags are exactly the
//   standalone misspellings — nothing inside any address.
// ROW-013 controls: the fresh letters used as address parts, standing alone, are flagged at their
//   offsets — they are misspellings to the product, so the target's silence is the skipping.
// ROW-013 technique: every address shape the row names, fresh parts each run; the near-miss decoys
//   (the same misspelled words outside an address) sit in the same text; exact comparison.
// cases: ROW-013 target=ROW-013-no-part-of-an-address-email-or-handle-flagged-while-the-same-words-outside-are control=ROW-013-control-the-address-parts-alone-are-flagged

import { test } from '@playwright/test';
import { asActor, freshNonWord, freshRandom, type Rng } from './harness';
import { Offer, expectExact, fillers, freshLetters, requireNotDictionary } from './names-terms-helpers';

const STRIPPED = ['gestion', 'tecnico', 'informatica', 'administracion'];

function addresses(rng: Rng): { text: string; label: string }[] {
  const f = () => freshLetters(rng);
  const s = () => rng.pick(STRIPPED);
  return [
    { text: `https://www.${f()}.com/${f()}/${f()}?ref=${f()}&utm_source=${f()}`, label: 'https address with path and query' },
    { text: `http://${f()}-${f()}.es/empleos/${f()}.html`, label: 'http address' },
    { text: `https://${f()}.com.ar/${s()}#${f()}`, label: 'https address with fragment' },
    { text: `www.${s()}-${s()}.com`, label: 'www address with misspelling-like parts' },
    { text: `www.${f()}${f()}.com.mx/${s()}`, label: 'www address' },
    { text: `${f()}.com/${s()}/${f()}`, label: 'bare domain with path' },
    { text: `${f()}.es`, label: 'bare domain' },
    { text: `${f()}.${f()}@${f()}.com`, label: 'email address' },
    { text: `${s()}@${s()}.es`, label: 'email address with misspelling-like parts' },
    { text: `rrhh@${f()}-${f()}.com.ar`, label: 'email address' },
    { text: `@${f()}`, label: '@handle' },
    { text: `@${s()}_${s()}`, label: '@handle with misspelling-like parts' },
    { text: `@${f()}_${f()}`, label: '@handle' },
  ];
}

test('ROW-013-no-part-of-an-address-email-or-handle-flagged-while-the-same-words-outside-are', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireNotDictionary(STRIPPED, 'ROW-013 misspelling-like parts');
  const frames: [string, string][] = [[' ', ' '], [' (', ') '], [' ', ', '], [' ', '. '], [': ', ' ']];
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (const a of rng.shuffle(addresses(rng))) {
    const [before, after] = rng.pick(frames);
    o.put(' ' + fillers(rng, 1 + rng.int(2)) + before).keep(a.text, a.label).put(after + fillers(rng, 1));
  }
  // the near misses: the same misspellings, and a fresh non-word, outside any address
  for (const w of rng.shuffle([...STRIPPED, freshNonWord(rng)])) o.put(' ' + fillers(rng, 1 + rng.int(2)) + ' ').flag(w, 'misspelling outside any address');
  o.put(' ' + fillers(rng, 2) + '.');
  await expectExact(o, `ROW-013: nothing inside a web address, an email address or an @handle is flagged, while the same misspellings outside one are (seed ${rng.seed})`);
});

test('ROW-013-control-the-address-parts-alone-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (let i = 0; i < 4; i++) o.put(' ' + fillers(rng, 1) + ' ').flag(freshLetters(rng), 'address-part letters alone');
  o.put(' ' + fillers(rng, 2));
  await expectExact(o, `ROW-013 control: the fresh letters used as address parts are flagged when they stand alone (seed ${rng.seed})`);
});
