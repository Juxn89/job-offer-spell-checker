// Purpose: ROW-048 (REQ-022) — on the checker page, in every browser of the harness, a 31st check within
// one minute from one address is refused with a message to wait a moment, and the text in the box is left
// untouched; plus a control showing a check within the limit is answered and drawn.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-022's
// fail-if and A-013; offers built by server-limits-helpers.ts with fresh non-words per run.
//
// Test argument
// ROW-048 promise: at most 30 checks a minute from one network address; the excess is refused with a
//   message to wait a moment, the text left in the box untouched (REQ-022 fail-if arms 1-3; A-013 "the
//   excess refused with a message to wait a moment").
// ROW-048 wrong product: no limit at all (the 31st is checked and highlighted); a limit whose refusal the
//   page shows as nothing, as a no-errors result, or as a raw "429"; or a page that clears or replaces the
//   box on a refusal.
// ROW-048 given: the page open with an offer holding a fresh non-word in the box; the whole check budget
//   held (D-030) and 30 checks sent from this same address straight to the endpoint within the minute;
//   when: Revisar ortografía is pressed (the 31st check); then: a message asking to wait is shown, it is
//   not a no-errors result, no count line and no highlight appear, no check the page sent is answered
//   200, and the box holds the offer exactly.
// ROW-048 controls: the 30 checks before were accepted (the refusal is the 31st's, not an earlier one);
//   no wait message is shown before the press; the control case shows a press within the limit is
//   answered and its non-word highlighted — the page, the check and the reading all work.
// ROW-048 technique: the threshold's first value over (31) with the 30 under it sent in the same minute
//   through the API, so the only difference from the control is the count; the browser is the boundary
//   because the message and the box are what the writer sees.
// cases: ROW-048 target=ROW-048-the-31st-check-in-a-minute-is-refused-on-the-page-with-a-message-to-wait-and-the-text-untouched control=ROW-048-control-a-check-within-the-limit-is-answered-and-highlighted

import { expect, test } from '@playwright/test';
import { ROLES, asActor, enterOffer, freshRandom, holdCheckBudget, openChecker, pressCheck, readHighlights, sendRaw } from './harness';
import {
  ASKS_TO_WAIT,
  NO_ERRORS,
  PER_MINUTE,
  expectShown,
  offerValue,
  ordinaryOffer,
  pressCheckButton,
  visibleText,
  watchChecks,
} from './server-limits-helpers';

test('ROW-048-the-31st-check-in-a-minute-is-refused-on-the-page-with-a-message-to-wait-and-the-text-untouched', async ({ page }) => {
  test.setTimeout(500_000);
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = ordinaryOffer(rng);
  const filler = ordinaryOffer(rng).text;

  await openChecker(page);
  await enterOffer(page, text);
  expect(await visibleText(page, ROLES.message), 'ROW-048: no message asks to wait before the press').not.toMatch(ASKS_TO_WAIT);

  const hold = await holdCheckBudget();
  try {
    const statuses: number[] = [];
    for (let i = 0; i < PER_MINUTE; i++) statuses.push((await sendRaw({ body: { text: filler }, pace: false })).status);
    expect(statuses.filter((s) => s !== 200), 'ROW-048: the 30 checks of the minute from this address are accepted').toEqual([]);

    const seen = watchChecks(page);
    await pressCheckButton(page, 'no-wait');
    await expectShown(page, ROLES.message, ASKS_TO_WAIT, 'ROW-048: the 31st check within the minute is refused with a message to wait a moment');

    expect(await visibleText(page, ROLES.message), 'ROW-048: the refusal is not a no-errors result').not.toMatch(NO_ERRORS);
    expect(await offerValue(page), 'ROW-048: the text stays in the box untouched').toBe(text);
    expect(await readHighlights(page, text), 'ROW-048: nothing is highlighted — the refused check checked nothing').toEqual([]);
    expect(await visibleText(page, ROLES.count), 'ROW-048: no count line is shown for a refused check').toBe('');
    expect(seen.filter((s) => s.status === 200).length, 'ROW-048: no check the page sent was answered as checked').toBe(0);
  } finally {
    await hold.release();
  }
});

test('ROW-048-control-a-check-within-the-limit-is-answered-and-highlighted', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = ordinaryOffer(rng);
  await openChecker(page);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, 'ROW-048 control: a check within the limit is answered').toBe(200);
  await expect
    .poll(async () => (await readHighlights(page, text)).map((h) => ({ word: h.word, start: h.start, end: h.end })), {
      message: `ROW-048 control: the non-word "${nonWord.word}" is highlighted where it stands`,
      timeout: 15_000,
    })
    .toEqual([nonWord]);
  expect(await visibleText(page, ROLES.message), 'ROW-048 control: no message asks to wait for a check within the limit').not.toMatch(ASKS_TO_WAIT);
});
