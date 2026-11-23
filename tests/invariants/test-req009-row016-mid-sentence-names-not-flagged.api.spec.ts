// Purpose: ROW-016 (REQ-009) — through the check endpoint, a capitalised mid-sentence name the dictionary
// does not hold (Tecnosoluciones, Tegucigalpa, fresh names) is not flagged, while the same kind of word
// is flagged in lower case or where a sentence opens.
// Provenance: hand-authored from REQ-009's fail-if examples and A-012; fresh names per run (freshName:
// checked against the dictionary oracle in every casing and accent restoration); no expected value comes
// from the product.
//
// Test argument
// ROW-016 promise: a capitalised company, city or person name in mid-sentence that is not in the
//   dictionary is not flagged (REQ-009 fail-if arm 1; A-012 "a word starting with a capital letter that
//   is not the first word of a sentence and is not in the dictionary is treated as a proper noun").
// ROW-016 wrong product: a plain dictionary lookup, flagging every company and place an offer names;
//   or one that exempts only names on a built-in list (Tegucigalpa yes, a fresh company no); or the
//   overreach, exempting every capitalised word, so a misspelled sentence opening goes unflagged.
// ROW-016 given: Tecnosoluciones and Tegucigalpa and fresh names, mid-sentence after a word, a comma,
//   "de", inside brackets and quotes and closing a sentence; near misses in the same text: fresh
//   names in lower case mid-sentence, and fresh names opening a sentence; when: POST /api/check; then:
//   exactly the near misses are flagged — no mid-sentence capitalised name.
// ROW-016 controls: fresh names where a sentence opens, in a text with no mid-sentence name, are
//   flagged — names of this shape are misspellings to the product unless the rule exempts them.
// ROW-016 technique: the row's examples and a fresh sample of names (no product can list them) in every
//   mid-sentence frame; exact comparison with decoys of the same letters in other positions.
// cases: ROW-016 target=ROW-016-capitalised-mid-sentence-names-not-in-the-dictionary-not-flagged control=ROW-016-control-fresh-names-opening-a-sentence-are-flagged

import { test } from '@playwright/test';
import { asActor, freshRandom } from './harness';
import { Offer, expectExact, fillers, freshName, requireNotDictionary } from './names-terms-helpers';

const FRAMES: [string, string][] = [[' ', ' '], [', ', ','], [' de ', ' '], [' (', ')'], [' «', '»'], [' “', '”'], [' ', '.']];

test('ROW-016-capitalised-mid-sentence-names-not-in-the-dictionary-not-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  requireNotDictionary(['Tecnosoluciones', 'Tegucigalpa'], 'ROW-016 named examples');
  type Item = { word: string; kind: 'name' | 'lower' | 'opening' };
  const items: Item[] = [
    { word: 'Tecnosoluciones', kind: 'name' },
    { word: 'Tegucigalpa', kind: 'name' },
    ...Array.from({ length: 14 }, () => ({ word: freshName(rng), kind: 'name' as const })),
    ...Array.from({ length: 4 }, () => ({ word: freshName(rng).toLowerCase(), kind: 'lower' as const })),
    ...Array.from({ length: 4 }, () => ({ word: freshName(rng), kind: 'opening' as const })),
  ];
  const o = new Offer().put(fillers(rng, 2, { capital: true }));
  for (const it of rng.shuffle(items)) {
    if (it.kind === 'opening') {
      o.put('. ').flag(it.word, 'fresh name opening a sentence').put(' ' + fillers(rng, 2));
      continue;
    }
    const [before, after] = rng.pick(FRAMES);
    o.put(' ' + fillers(rng, 1 + rng.int(2)) + before);
    if (it.kind === 'name') o.keep(it.word, 'capitalised mid-sentence name');
    else o.flag(it.word, 'fresh name in lower case mid-sentence');
    o.put(after + ' ' + fillers(rng, 2));
  }
  o.put('.');
  await expectExact(o, `ROW-016: capitalised mid-sentence names not in the dictionary (Tecnosoluciones, Tegucigalpa, fresh names) are not flagged (seed ${rng.seed})`);
});

test('ROW-016-control-fresh-names-opening-a-sentence-are-flagged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const o = new Offer().flag(freshName(rng), 'fresh name opening the text').put(' ' + fillers(rng, 3));
  for (let i = 0; i < 3; i++) o.put('. ').flag(freshName(rng), 'fresh name opening a sentence').put(' ' + fillers(rng, 3));
  o.put('.');
  await expectExact(o, `ROW-016 control: fresh names where a sentence opens are flagged (seed ${rng.seed})`);
});
