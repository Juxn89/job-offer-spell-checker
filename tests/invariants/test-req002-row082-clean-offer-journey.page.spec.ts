// Purpose: ROW-082 (REQ-002) — the clean-offer journey on the checker page, in every browser of the
// harness: a writer pastes an offer with no misspelling, presses Check spelling, and is told no spelling
// errors were found, with nothing highlighted — one step per transition, each operating its real control.
// Provenance: generated with fresh values per run — two correctly accented words drawn from
// tests/invariants/spanish-dictionary.ts (dictionary-es 4.0.0, pinned by SHA-256) among everyday offer
// words, every word of the offer proved a dictionary word by that oracle; nothing expected comes from
// the product's answer.
// Deployed shape: the harness contract declares no deployed-selector: (D-025), so this journey carries
// none; it runs in the one inline pass.
//
// Test argument
// ROW-082 promise: the PRD's clean-offer flow — after a check of an offer with no misspelling, the line
//   above the text states that no spelling errors were found, with nothing highlighted (REQ-002, A-005:
//   "a line says how many words were flagged or 'No spelling errors found'"); the paste shows plain
//   (REQ-014, A-019), the page itself in Spanish (A-020).
// ROW-082 wrong product: a page that, given no flags, shows nothing at all (the writer cannot tell a
//   clean offer from a check that did not run), or one that flags the correctly accented words of the
//   offer (an accent-insensitive or ASCII-only dictionary) and so highlights them.
// ROW-082 given: a formatted offer (bold heading, a link, a coloured word, blank lines, bullets, a double
//   space) of everyday offer words plus two fresh, correctly accented dictionary words mid-sentence,
//   capitals only at sentence starts, no ano/anos, no name or acronym; when: a real paste
//   (ControlOrMeta+V) into the box, then the check button; then: the count line or message line
//   (data-element="count" / "message", D-021) shows a no-spelling-errors statement and no non-zero
//   number, and no highlight is on the page — where before the press neither line said so.
// ROW-082 controls: the same kind of pasted offer reaches the page's own check request unchanged and is
//   answered 200 — the clipboard, the paste and the check path work in this browser, untouched by any
//   fault in the message or the highlighting.
// ROW-082 technique: one browser test per journey (the journeys pass's shape), a step per transition;
//   before-and-after on the message; fresh correct accented words as near misses for an accent-blind
//   checker; whole-list comparison of highlights (none); all four harness projects (REQ-042).
// cases: ROW-082 target=ROW-082-writer-with-a-clean-offer-is-told-no-spelling-errors-were-found control=ROW-082-control-a-pasted-clean-offer-reaches-the-page-check-unchanged

import { expect, test, type Page } from '@playwright/test';
import { accentPopulation, asActor, fillerWords, freshRandom, openChecker, pressCheck, readHighlights, type Rng } from './harness';
import {
  buildOffer,
  formattingInOffer,
  NO_ERRORS,
  pasteAndSendCheck,
  pasteIntoOffer,
  putOnClipboard,
  readLine,
  readOfferText,
  unplacedMisspellings,
  type Offer,
} from './journeys-helpers';

const WAIT_MS = 15_000;
const NOUNS = ['desarrollo', 'clientes', 'proyectos', 'oficina', 'empresa', 'equipo'];

/** A clean offer: everyday words and two fresh correctly accented dictionary words, formatted. */
function cleanOffer(rng: Rng): Offer {
  const fillers = fillerWords();
  const nouns = rng.shuffle(NOUNS.filter((n) => fillers.includes(n)));
  if (nouns.length < 2) throw new Error('setup: the filler words lost the nouns this offer uses');
  const [a, b] = rng.shuffle(accentPopulation()).filter((p) => (p.word.match(/[áéíóú]/g) ?? []).length === 1);
  return buildOffer([
    { text: 'Oferta de trabajo', fmt: 'bold' },
    { text: `\n\nBuscamos una persona responsable para el equipo de ${nouns[0]} y ` },
    { text: a.word, key: 'a' },
    { text: '.\n\nTareas:\n• La ' },
    { text: b.word, key: 'b' },
    { text: ` de proyectos con ` },
    { text: 'clientes', fmt: 'link' },
    { text: `.\n  - Horario  flexible y jornada completa en la ${nouns[1]}.\n\nOfrecemos contrato y ` },
    { text: 'formación', fmt: 'colour' },
    { text: '.' },
  ]);
}

/** What the count and message lines (D-021) state: 'no-errors' when one of them, visible, states that
 *  no spelling errors were found and neither shows a number other than 0; otherwise what they show. */
async function cleanStatement(page: Page): Promise<string> {
  const count = await readLine(page, 'count');
  const message = await readLine(page, 'message');
  const lines = [count, message].filter((l) => l.visible);
  const nonZero = lines.flatMap((l) => l.numbers).filter((n) => Number(n) !== 0);
  if (lines.some((l) => NO_ERRORS.test(l.text)) && nonZero.length === 0) return 'no-errors';
  return `count ${JSON.stringify(count.text)} · message ${JSON.stringify(message.text)}`;
}

test('ROW-082-writer-with-a-clean-offer-is-told-no-spelling-errors-were-found', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = cleanOffer(rng);
  expect(unplacedMisspellings(offer.plain, []), `ROW-082 setup: every word of the offer is a dictionary word (seed ${rng.seed})`).toEqual([]);
  expect(/\banos?\b/i.test(offer.plain), 'ROW-082 setup: the offer holds no ano or anos').toBe(false);

  await test.step('ROW-082 transition 1: anonymous at empty page · text box · pastes an offer with no misspelling → offer in box: text shown plain', async () => {
    await openChecker(page);
    expect(await readOfferText(page), 'ROW-082 t1: the box is empty before the paste').toBe('');
    await putOnClipboard(page, offer);
    await pasteIntoOffer(page);
    await expect
      .poll(() => readOfferText(page), { message: `ROW-082 t1: the box shows the pasted offer exactly — every line break, blank line, bullet and space (seed ${rng.seed})`, timeout: WAIT_MS })
      .toBe(offer.plain);
    expect(await formattingInOffer(page), 'ROW-082 t1: the pasted offer\'s bold, link and colour are dropped').toEqual([]);
    expect(await cleanStatement(page), 'ROW-082 t1: no no-spelling-errors statement shows before Check spelling').not.toBe('no-errors');
  });

  await test.step('ROW-082 transition 2: anonymous at offer in box · Check spelling · press → checked: the no-spelling-errors message shows and nothing is highlighted', async () => {
    const { status } = await pressCheck(page);
    expect(status, 'ROW-082 t2: the page\'s check request is answered').toBe(200);
    await expect
      .poll(() => cleanStatement(page), {
        message: `ROW-082 t2: the count or message line states that no spelling errors were found, with no count above 0 (seed ${rng.seed}; accented words ${offer.at.a.word}, ${offer.at.b.word})`,
        timeout: WAIT_MS,
      })
      .toBe('no-errors');
    expect(await readHighlights(page, offer.plain), `ROW-082 t2: nothing is highlighted — not "${offer.at.a.word}", not "${offer.at.b.word}", no other word`).toEqual([]);
    expect(await readOfferText(page), 'ROW-082 t2: checking leaves the text exactly as pasted').toBe(offer.plain);
  });
});

test('ROW-082-control-a-pasted-clean-offer-reaches-the-page-check-unchanged', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = cleanOffer(rng);
  await openChecker(page);
  expect(await readOfferText(page), 'ROW-082 control: the box is empty before the paste').toBe('');
  const { status, sent } = await pasteAndSendCheck(page, offer);
  expect(sent, `ROW-082 control: the page's check request carries the pasted offer exactly (seed ${rng.seed})`).toBe(offer.plain);
  expect(status, 'ROW-082 control: the page\'s check request is answered').toBe(200);
});
