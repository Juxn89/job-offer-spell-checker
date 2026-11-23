// Purpose: ROW-081 (REQ-001, REQ-002, REQ-010, REQ-011, REQ-012, REQ-014, REQ-015) — the writer's
// journey on the checker page, in every browser of the harness: paste a formatted offer, check it, fix
// gestion, ignore the brand name, take the last word's first suggestion, and copy the offer out — one
// step per transition, each operating that transition's real control and asserting its effect.
// Provenance: generated with fresh values per run — the brand name is a fresh non-word, the third
// misspelling an accent-stripped word drawn from tests/invariants/spanish-dictionary.ts (dictionary-es
// 4.0.0, pinned by SHA-256) — and every expected text, position and count is the test's own record of
// what it pasted and chose, never the product's answer.
// Deployed shape: the harness contract declares no deployed-selector: (D-025), so this journey carries
// none; it runs in the one inline pass.
//
// Test argument
// ROW-081 promise: the PRD's writer journey (ROW-081's six transitions) — the paste is kept plain with
//   its line breaks, blank lines, bullets and spacing (REQ-014, A-019); Check spelling highlights the
//   three misspellings in place and the count line says 3 (REQ-001, REQ-002, A-005); gestion's list
//   offers gestión and choosing it replaces that word only, its highlight goes and the count drops to 2
//   (REQ-010, REQ-011, A-018); Ignore on the brand name leaves the text as it is and the count drops to
//   1 (REQ-012, A-018); the last word's first suggestion is its accent correction (REQ-010: "the
//   expected correction of a one-letter or accent error … is the first suggestion") and the count
//   reaches 0; Copy text puts exactly the box's text — the pasted text with exactly the two
//   replacements — on the clipboard and says so (REQ-015, A-006, A-019).
// ROW-081 wrong product: a page whose Replace writes the suggestion over the first match of the word
//   or re-renders the text from the check's answer (dropping the blank lines or the double space),
//   whose Ignore leaves the count at its old value, or whose Copy text copies the text as it was when
//   checked (without the replacements) — each looks fine on a one-line offer with one error.
// ROW-081 given: a formatted offer (bold heading, a link, a coloured word; blank lines, a "•" bullet, an
//   indented "-" bullet, a double space) holding gestion mid-sentence, a fresh capitalised brand name at
//   the start of a line (a sentence start, so REQ-009/REQ-035 make it checked, not excused as a name),
//   and a fresh lower-case accent error whose only accent restoration is a dictionary word and which is
//   one letter away from no other dictionary word (so its expected first suggestion is not in doubt); every other
//   word a dictionary word by the oracle. when: each transition's control is operated in the browser —
//   a real paste (ControlOrMeta+V), the check button, a click or tap where each highlighted word is
//   drawn, the suggestion and Ignore choices (data-element="suggestion" / "ignore", D-021's rule), Copy
//   text. then: after each transition, the box's exact text, the exact list of highlights with their
//   positions, and the count line's number; at the end the clipboard's exact text and the confirmation.
// ROW-081 controls: the same kind of pasted offer reaches the page's own check request unchanged and is
//   answered 200 — the clipboard, the paste and the check path work in this browser, untouched by any
//   fault in highlighting, replacing, ignoring, counting or copying.
// ROW-081 technique: one browser test per journey (the journeys pass's shape), a step per transition in
//   the row's order; before-and-after on every effect (empty box before the paste, no highlight before
//   the check, the confirmation absent before Copy text, the clipboard holding the unfixed text before
//   it); fresh values; whole-list comparisons; the run in all four harness projects (REQ-042).
// cases: ROW-081 target=ROW-081-writer-pastes-checks-replaces-ignores-and-copies-the-offer control=ROW-081-control-a-pasted-offer-reaches-the-page-check-unchanged

import { expect, test, type Page } from '@playwright/test';
import {
  accentPopulation,
  asActor,
  el,
  fillerWords,
  freshRandom,
  hasInclusiveReading,
  isDictionaryWord,
  openChecker,
  pressCheck,
  readHighlights,
  type Highlight,
  type Rng,
} from './harness';
import {
  buildOffer,
  flagFor,
  formattingInOffer,
  ignoreChoice,
  NO_ERRORS,
  pasteAndSendCheck,
  pasteIntoOffer,
  pointAt,
  pressControl,
  putOnClipboard,
  readClipboard,
  readLine,
  readOfferText,
  suggestions,
  unplacedMisspellings,
  waitPresent,
  writeAt,
  type Offer,
} from './journeys-helpers';

const WAIT_MS = 15_000;
const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

/** Every dictionary word made by putting one acute accent on one vowel of `bare`. */
function accentRestorations(bare: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < bare.length; i++) {
    const acute = ACUTE[bare[i]];
    if (acute) {
      const w = bare.slice(0, i) + acute + bare.slice(i + 1);
      if (isDictionaryWord(w)) out.push(w);
    }
  }
  return out;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyzáéíóúüñ';

/** True when some dictionary word other than `except` is one letter away from `bare`: one letter
 *  changed, added, removed, or two neighbours swapped. */
function hasOtherOneLetterCorrection(bare: string, except: string): boolean {
  const seen = new Set<string>([except, bare]);
  const tryWord = (w: string) => {
    if (seen.has(w)) return false;
    seen.add(w);
    return isDictionaryWord(w);
  };
  for (let i = 0; i <= bare.length; i++) {
    for (const c of LETTERS) {
      if (i < bare.length && tryWord(bare.slice(0, i) + c + bare.slice(i + 1))) return true;
      if (tryWord(bare.slice(0, i) + c + bare.slice(i))) return true;
    }
    if (i < bare.length && tryWord(bare.slice(0, i) + bare.slice(i + 1))) return true;
    if (i + 1 < bare.length && tryWord(bare.slice(0, i) + bare[i + 1] + bare[i] + bare.slice(i + 2))) return true;
  }
  return false;
}

/** A fresh accent error: a lower-case dictionary word with one acute accent whose stripped form has
 *  exactly one accent restoration in the dictionary and no other one-letter correction — so its
 *  expected first suggestion (REQ-010) is that restoration, unambiguously. */
function freshAccentError(rng: Rng): { wrong: string; right: string } {
  for (const p of rng.shuffle(accentPopulation())) {
    if ((p.word.match(/[áéíóú]/g) ?? []).length !== 1) continue;
    if (p.stripped.includes('gestion') || 'gestion'.includes(p.stripped)) continue;
    const r = accentRestorations(p.stripped);
    if (r.length !== 1 || r[0] !== p.word) continue;
    if (hasOtherOneLetterCorrection(p.stripped, p.word)) continue;
    return { wrong: p.stripped, right: p.word };
  }
  throw new Error('setup: the accent population offers no word with a single, unambiguous accent correction');
}

/** A fresh brand name: a capitalised pronounceable non-word, with no accent restoration and no
 *  inclusive reading — a word no dictionary, rule or exemption holds at the start of a line. */
function freshBrand(rng: Rng): string {
  const C = 'bdfglmnprstvz';
  const V = 'aeiou';
  for (;;) {
    let w = '';
    for (let i = 0; i < 4; i++) w += C[rng.int(C.length)] + V[rng.int(V.length)];
    const cap = w[0].toUpperCase() + w.slice(1);
    if (isDictionaryWord(w) || isDictionaryWord(cap) || hasInclusiveReading(w) || accentRestorations(w).length > 0) continue;
    return cap;
  }
}

const NOUNS = ['desarrollo', 'clientes', 'proyectos', 'oficina', 'empresa', 'equipo'];

/** The journey's offer: gestion, a brand name and one more misspelling, in a formatted offer. */
function writerOffer(rng: Rng, brand: string, third: string): Offer {
  const fillers = fillerWords();
  const nouns = rng.shuffle(NOUNS.filter((n) => fillers.includes(n)));
  if (nouns.length < 3) throw new Error('setup: the filler words lost the nouns this offer uses');
  return buildOffer([
    { text: 'Oferta de trabajo', fmt: 'bold' },
    { text: '\n\n' },
    { text: brand, key: 'brand' },
    { text: ` busca una persona para el equipo de ${nouns[0]}.\n\nTareas:\n• La ` },
    { text: 'gestion', key: 'gestion' },
    { text: ' de ' },
    { text: 'proyectos', fmt: 'link' },
    { text: ' con clientes.\n• Apoyo  ' },
    { text: third, key: 'third' },
    { text: ` en ${nouns[1]} y ${nouns[2]}.\n  - Horario flexible y jornada completa.\n\nOfrecemos contrato y ` },
    { text: 'formación', fmt: 'colour' },
    { text: '.' },
  ]);
}

const shown = (p: { start: number; end: number; word: string }): Highlight => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true });
const byStart = (xs: Highlight[]) => [...xs].sort((a, b) => a.start - b.start);

async function countNumbers(page: Page): Promise<string[] | 'hidden'> {
  const line = await readLine(page, 'count');
  return line.visible ? line.numbers : 'hidden';
}

async function checkerText(page: Page): Promise<string> {
  const region = el(page, 'checker').first();
  await expect(region, 'ROW-081: the checker section (data-element="checker") is on the page').toBeVisible({ timeout: WAIT_MS });
  return region.innerText();
}

test('ROW-081-writer-pastes-checks-replaces-ignores-and-copies-the-offer', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const brand = freshBrand(rng);
  const third = freshAccentError(rng);
  const offer = writerOffer(rng, brand, third.wrong);
  const { at } = offer;
  expect(unplacedMisspellings(offer.plain, [brand, 'gestion', third.wrong]), `ROW-081 setup: the offer's other words are dictionary words (seed ${rng.seed})`).toEqual([]);
  expect(isDictionaryWord('gestion') || isDictionaryWord(third.wrong) || isDictionaryWord(brand), 'ROW-081 setup: the three placed words are not dictionary words').toBe(false);

  // The test's own record of the text at each stage (both replacements keep the word's length).
  const afterGestion = writeAt(offer.plain, at.gestion.start, 'gestión');
  const afterAll = writeAt(afterGestion, at.third.start, third.right);
  expect(afterAll.length, 'ROW-081 setup: the replacements keep the text\'s length').toBe(offer.plain.length);
  const seed = `(seed ${rng.seed}; brand ${brand}; third ${third.wrong}→${third.right})`;

  await test.step('ROW-081 transition 1: anonymous at empty page · text box · pastes a formatted offer holding gestion, a brand name and one more misspelling → offer in box: the text is shown plain, line breaks kept', async () => {
    await openChecker(page);
    expect(await readOfferText(page), 'ROW-081 t1: the box is empty before the paste').toBe('');
    await putOnClipboard(page, offer);
    await pasteIntoOffer(page);
    await expect
      .poll(() => readOfferText(page), { message: `ROW-081 t1: the box shows the pasted offer exactly — every line break, blank line, bullet and space ${seed}`, timeout: WAIT_MS })
      .toBe(offer.plain);
    expect(await formattingInOffer(page), 'ROW-081 t1: the pasted offer\'s bold, link and colour are dropped').toEqual([]);
    expect(await readHighlights(page, offer.plain), 'ROW-081 t1: nothing is highlighted before Check spelling').toEqual([]);
  });

  await test.step('ROW-081 transition 2: anonymous at offer in box · Check spelling · press → checked: three words highlighted and the count line says 3', async () => {
    const { status } = await pressCheck(page);
    expect(status, 'ROW-081 t2: the page\'s check request is answered').toBe(200);
    await expect
      .poll(() => readHighlights(page, offer.plain), {
        message: `ROW-081 t2: exactly "${brand}", "gestion" and "${third.wrong}" are highlighted, each where it stands ${seed}`,
        timeout: WAIT_MS,
      })
      .toEqual(byStart([shown(at.brand), shown(at.gestion), shown(at.third)]));
    await expect.poll(() => countNumbers(page), { message: 'ROW-081 t2: the count line shows, and its one number is 3', timeout: WAIT_MS }).toEqual(['3']);
    expect(await readOfferText(page), 'ROW-081 t2: checking leaves the text exactly as pasted').toBe(offer.plain);
  });

  await test.step('ROW-081 transition 3: anonymous at checked · the highlighted gestion · open, choose gestión → two flagged: the word reads gestión, its highlight gone, count 2', async () => {
    await pointAt(page, flagFor(page, 'gestion').first(), 'ROW-081 t3: the highlighted "gestion"');
    await waitPresent(suggestions(page), 'ROW-081 t3: opening the highlighted "gestion" shows its suggestions (data-element="suggestion")');
    const choice = suggestions(page).filter({ hasText: /^\s*gestión\s*$/ });
    await waitPresent(choice, 'ROW-081 t3: "gestión" is among the suggestions for "gestion"');
    await pressControl(page, choice.first());
    await expect
      .poll(() => readOfferText(page), { message: `ROW-081 t3: only that word changed — the box reads the pasted offer with gestion → gestión ${seed}`, timeout: WAIT_MS })
      .toBe(afterGestion);
    await expect
      .poll(() => readHighlights(page, afterGestion), { message: `ROW-081 t3: gestión is no longer highlighted; "${brand}" and "${third.wrong}" still are, where they stand`, timeout: WAIT_MS })
      .toEqual(byStart([shown(at.brand), shown(at.third)]));
    await expect.poll(() => countNumbers(page), { message: 'ROW-081 t3: the count line says 2', timeout: WAIT_MS }).toEqual(['2']);
  });

  await test.step('ROW-081 transition 4: anonymous at two flagged · the highlighted brand name · Ignore → one flagged: text unchanged, count 1', async () => {
    await pointAt(page, flagFor(page, brand).first(), `ROW-081 t4: the highlighted brand name "${brand}"`);
    await waitPresent(ignoreChoice(page), `ROW-081 t4: opening the highlighted "${brand}" shows the Ignore choice (data-element="ignore")`);
    await pressControl(page, ignoreChoice(page).first());
    await expect
      .poll(() => readHighlights(page, afterGestion), { message: `ROW-081 t4: "${brand}" is no longer highlighted; only "${third.wrong}" is, where it stands`, timeout: WAIT_MS })
      .toEqual([shown(at.third)]);
    await expect.poll(() => countNumbers(page), { message: 'ROW-081 t4: the count line says 1', timeout: WAIT_MS }).toEqual(['1']);
    expect(await readOfferText(page), `ROW-081 t4: Ignore changes no character of the text ${seed}`).toBe(afterGestion);
  });

  await test.step('ROW-081 transition 5: anonymous at one flagged · the last highlighted word · choose its first suggestion → none flagged: count 0', async () => {
    await pointAt(page, flagFor(page, third.wrong).first(), `ROW-081 t5: the highlighted "${third.wrong}"`);
    await waitPresent(suggestions(page), `ROW-081 t5: opening the highlighted "${third.wrong}" shows its suggestions (data-element="suggestion")`);
    await pressControl(page, suggestions(page).first());
    await expect
      .poll(() => readOfferText(page), { message: `ROW-081 t5: the first suggestion for "${third.wrong}" is its accent correction "${third.right}", written over that word only ${seed}`, timeout: WAIT_MS })
      .toBe(afterAll);
    await expect.poll(() => readHighlights(page, afterAll), { message: 'ROW-081 t5: nothing is highlighted any more', timeout: WAIT_MS }).toEqual([]);
    await expect
      .poll(
        async () => {
          const line = await readLine(page, 'count');
          if (!line.visible) return 'hidden';
          if (line.numbers.length === 0 && NO_ERRORS.test(line.text)) return 'zero';
          return line.numbers.length === 1 && line.numbers[0] === '0' ? 'zero' : `says ${JSON.stringify(line.text)}`;
        },
        { message: 'ROW-081 t5: the count line shows a count of 0', timeout: WAIT_MS },
      )
      .toBe('zero');
  });

  await test.step('ROW-081 transition 6: anonymous at none flagged · Copy text · press → copied: the clipboard holds the pasted text with exactly the two replacements, and a confirmation shows', async () => {
    expect(await readClipboard(page), 'ROW-081 t6: before Copy text the clipboard still holds the offer as pasted, without the replacements').toBe(offer.plain);
    expect(await checkerText(page), 'ROW-081 t6: no copied confirmation shows before Copy text is pressed').not.toMatch(/copiad/i);
    await pressControl(page, el(page, 'copy').first());
    await expect
      .poll(() => checkerText(page), { message: 'ROW-081 t6: a confirmation that the text was copied shows in the checker', timeout: WAIT_MS })
      .toMatch(/copiad/i);
    expect(await readClipboard(page), `ROW-081 t6: the clipboard holds the pasted text with exactly gestion → gestión and ${third.wrong} → ${third.right}, every other character as pasted ${seed}`).toBe(afterAll);
  });
});

test('ROW-081-control-a-pasted-offer-reaches-the-page-check-unchanged', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = writerOffer(rng, freshBrand(rng), freshAccentError(rng).wrong);
  await openChecker(page);
  expect(await readOfferText(page), 'ROW-081 control: the box is empty before the paste').toBe('');
  const { status, sent } = await pasteAndSendCheck(page, offer);
  expect(sent, `ROW-081 control: the page's check request carries the pasted offer exactly (seed ${rng.seed})`).toBe(offer.plain);
  expect(status, 'ROW-081 control: the page\'s check request is answered').toBe(200);
});
