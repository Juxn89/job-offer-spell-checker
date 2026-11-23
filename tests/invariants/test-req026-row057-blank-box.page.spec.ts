// Purpose: ROW-057 (REQ-026) — on the checker page, in every browser of the harness, pressing Revisar
// ortografía with an empty box or a box holding only blank characters sends no check, shows no count line
// and no no-errors message, and shows the prompt to write or paste an offer.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-026's
// fail-if and A-027; the sentinel offer's non-word is fresh per run.
//
// Test argument
// ROW-057 promise: "pressing Check spelling with an empty box, or with only spaces, sends no check and
//   shows a prompt to write or paste an offer"; fail-if: a check is sent, a count or a no-errors message
//   is shown, or no prompt (REQ-026; A-027).
// ROW-057 wrong product: a page that sends the empty text and draws the answer ("No se han encontrado
//   errores" — an empty press read as a clean offer, the harm REQ-026 serves); one that tests
//   `text === ''` only, so spaces, a line break, a tab or a non-breaking space pasted from a document go
//   to the server; one that does nothing at all.
// ROW-057 given: a freshly loaded page per case — the box left empty, then "   ", then line breaks and a
//   tab, then non-breaking and ideographic spaces; when: Revisar ortografía is pressed; then: a visible
//   message asks to write or paste an offer, it is not the no-errors wording, and no count line shows.
//   After all of them, an ordinary offer is entered and pressed (the sentinel): the page's requests are
//   recorded in order, so the first and only POST /api/check must be the sentinel's.
// ROW-057 controls: before each press no prompt is shown (the prompt is the press's effect); the
//   sentinel's check is sent and answered 200 — the recording sees the page's checks, so "none sent" by
//   the blank presses is an observation, not a blind spot.
// ROW-057 technique: one case per kind of blank (the near misses of "empty"), and an ordering sentinel
//   instead of a fixed wait to prove a request was never sent.
// cases: ROW-057 target=ROW-057-an-empty-or-blank-box-sends-no-check-shows-no-count-and-prompts-for-an-offer control=ROW-057-control-a-press-with-an-offer-sends-its-check-and-shows-no-prompt

import { expect, test } from '@playwright/test';
import { ROLES, asActor, enterOffer, freshRandom, openChecker, pressCheck } from './harness';
import { ASKS_FOR_AN_OFFER, NO_ERRORS, ordinaryOffer, pressCheckButton, visibleText, watchChecks } from './server-limits-helpers';

const BLANKS: { name: string; text: string }[] = [
  { name: 'empty', text: '' },
  { name: 'spaces', text: '   ' },
  { name: 'line breaks and a tab', text: '\n\n \t \n' },
  { name: 'non-breaking and ideographic spaces', text: '  　 ' },
];

test('ROW-057-an-empty-or-blank-box-sends-no-check-shows-no-count-and-prompts-for-an-offer', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const seen = watchChecks(page);
  const results: { blank: string; prompt: string; noErrors: boolean; count: string }[] = [];
  for (const blank of BLANKS) {
    await openChecker(page);
    await enterOffer(page, blank.text);
    expect(await visibleText(page, ROLES.message), `ROW-057 (${blank.name}): no prompt before the press`).not.toMatch(ASKS_FOR_AN_OFFER);
    await pressCheckButton(page, 'none'); // a blank press must send nothing: no slot is taken
    await expect
      .poll(() => visibleText(page, ROLES.message), { message: `ROW-057 (${blank.name}): the page prompts to write or paste an offer`, timeout: 15_000 })
      .toMatch(ASKS_FOR_AN_OFFER);
    const prompt = await visibleText(page, ROLES.message);
    results.push({ blank: blank.name, prompt, noErrors: NO_ERRORS.test(prompt), count: await visibleText(page, ROLES.count) });
  }
  expect(results.filter((r) => r.noErrors || r.count !== ''), 'ROW-057: no blank press shows a count line or a no-errors message').toEqual([]);

  // The sentinel: any request a blank press sent was sent before this one.
  const { text } = ordinaryOffer(rng);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, 'ROW-057: the sentinel check is answered').toBe(200);
  expect(
    seen.map((s) => (s.text === text ? 'sentinel' : `a check of ${JSON.stringify(s.text)}`)),
    'ROW-057: no blank press sent a check — the only check the page sent is the sentinel\'s',
  ).toEqual(['sentinel']);
});

test('ROW-057-control-a-press-with-an-offer-sends-its-check-and-shows-no-prompt', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const seen = watchChecks(page);
  const { text } = ordinaryOffer(rng);
  await openChecker(page);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, 'ROW-057 control: the check of an offer is answered').toBe(200);
  expect(seen.map((s) => s.text), 'ROW-057 control: the page sent the offer\'s check').toEqual([text]);
  await expect
    .poll(() => visibleText(page, ROLES.count), { message: 'ROW-057 control: the result line is shown', timeout: 15_000 })
    .not.toBe('');
  expect(await visibleText(page, ROLES.message), 'ROW-057 control: no prompt to write an offer when there is one').not.toMatch(ASKS_FOR_AN_OFFER);
});
