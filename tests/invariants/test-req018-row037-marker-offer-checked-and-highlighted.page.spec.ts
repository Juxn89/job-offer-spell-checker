// Purpose: ROW-037 (REQ-018) — the control of ROW-035: in every browser of the harness, the marker offer is
// checked normally — the page's own check is answered with exactly its two misspellings, and the page
// highlights exactly those two words at their places, the pseudo-name and the phrase left alone.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018, REQ-001
// and A-012; fresh markers per run; expected positions are the test's own record, never the product's answer.
//
// Test argument
// ROW-037 promise: control of ROW-035 — the marker offer is checked normally and its misspellings are returned
//   and highlighted (REQ-018: the privacy rows hold only if the text is really checked; REQ-001 the flags and
//   highlights; A-012 a capitalised mid-sentence word outside the dictionary is a proper noun, not flagged).
// ROW-037 wrong product: a "privacy" short-cut that, for texts holding a word it treats as a secret marker or
//   an unknown name, skips the check or drops it from the answer — the no-trace rows then pass on a product
//   that never processed the text; or a page that sends the text and draws nothing.
// ROW-037 given: a fresh marker offer — an unknown flagged word, a title-case pseudo-name mid-sentence, a
//   phrase of five accented dictionary words, an ordinary accent misspelling; when: it is entered and
//   Revisar ortografía pressed; then: the page's own POST /api/check carries the text unchanged and is answered
//   200 with exactly the accent misspelling and the unknown word at their offsets, and the page shows exactly
//   those two highlights at their places — and before the press it showed none.
// ROW-037 controls: the misspelling alone (no marker) in a second check is answered and highlighted at its
//   place — the page, the check and the highlight reading work apart from the markers.
// ROW-037 technique: exact whole-list comparison (no extra flag, none missing) of the answer and of the paint,
//   on the engine door per browser of the harness (RULE-014); positions from the test's own composition.
// cases: ROW-037 target=ROW-037-marker-offer-checked-normally-its-misspellings-returned-and-highlighted control=ROW-037-control-an-accent-misspelling-alone-is-returned-and-highlighted

import { expect, test, type Page } from '@playwright/test';
import {
  asActor,
  byPosition,
  CHECK_PATH,
  compose,
  enterOffer,
  freshRandom,
  openChecker,
  placeOf,
  pressCheck,
  readHighlights,
  type CheckAnswer,
  type Highlight,
  type Placed,
} from './harness';
import { markerOffer } from './privacy-text-helpers';

const shown = (p: Placed): Highlight => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true });

async function checkThroughPage(page: Page, text: string): Promise<{ sentText: unknown; status: number; flagged: unknown }> {
  const answered = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === CHECK_PATH, { timeout: 30_000 });
  await pressCheck(page);
  const res = await answered;
  let sentText: unknown;
  try {
    sentText = (JSON.parse(res.request().postData() ?? '') as { text?: unknown }).text;
  } catch {
    sentText = res.request().postData();
  }
  let flagged: unknown;
  try {
    flagged = byPosition(((await res.json()) as CheckAnswer).flagged.map(placeOf));
  } catch {
    flagged = 'not the D-020 answer';
  }
  return { sentText, status: res.status(), flagged };
}

test('ROW-037-marker-offer-checked-normally-its-misspellings-returned-and-highlighted', async ({ page }) => {
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  await openChecker(page);
  await enterOffer(page, offer.text);
  expect(await readHighlights(page, offer.text), 'ROW-037 setup: before the press, no highlight').toEqual([]);
  const sent = await checkThroughPage(page, offer.text);
  expect(sent, `ROW-037: the page sends ${JSON.stringify(offer.text)} unchanged and the answer flags exactly ${offer.misspelled.word} and ${offer.unknown.word} at their places`).toEqual({
    sentText: offer.text,
    status: 200,
    flagged: offer.flagged,
  });
  await expect
    .poll(() => readHighlights(page, offer.text), {
      message: `ROW-037: the page highlights exactly ${offer.misspelled.word} and ${offer.unknown.word}, each at its place — not the name ${offer.name.word}, not the phrase`,
      timeout: 15_000,
    })
    .toEqual(offer.flagged.map(shown));
});

test('ROW-037-control-an-accent-misspelling-alone-is-returned-and-highlighted', async ({ page }) => {
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  const { text, placed } = compose(['Buscamos', 'persona', 'con', offer.misspelled.word, 'para', 'el', 'equipo']);
  const expected = [placed[3]];
  await openChecker(page);
  await enterOffer(page, text);
  const sent = await checkThroughPage(page, text);
  expect(sent, `ROW-037 control: ${JSON.stringify(text)} is sent and answered with its one misspelling`).toEqual({ sentText: text, status: 200, flagged: expected });
  await expect
    .poll(() => readHighlights(page, text), { message: `ROW-037 control: ${offer.misspelled.word} is highlighted at its place`, timeout: 15_000 })
    .toEqual(expected.map(shown));
});
