// Purpose: ROW-118 (REQ-002, REQ-022) — on the checker page, in every browser of the harness, a second
// press of Revisar ortografía while a check is running, a fast double click or double tap included, sends
// no second check request, and the finished check draws one set of highlights that matches the count line.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); misspellings are fresh
// non-words (harness freshNonWord, checked against dictionary-es 4.0.0); expected highlights and count
// are the test's own record of what it placed.
//
// Test argument
// ROW-118 promise: a second press while a check runs, including a fast double tap, sends no second
//   request, and the finished check draws one set of highlights matching the count (ROW-118, origin
//   domain; REQ-002: the count line's number equals the highlighted words; REQ-022: every check counts
//   against the writer's 30 a minute, so a doubled request spends the writer's budget).
// ROW-118 wrong product: a button with no in-flight guard — each press posts /api/check, and each answer
//   appends its highlights, so the writer sees every word highlighted twice and a count of 8 for 4; or a
//   guard set only after the answer arrives (async), which a double tap slips through.
// ROW-118 given: three fresh non-words, one written twice (4 highlights), among filler words; the page's
//   own check request held in flight by the test (the browser's request is answered by the product, its
//   answer delivered to the page only when the test releases it, so "while a check runs" is certain and
//   no fixed sleep is used); when: (a) the button is double-clicked (double-tapped on the phone) as one
//   gesture, raw pointer input at its centre; (b) the button is pressed, and once its request is in flight
//   pressed again with raw pointer input (a disabled button is no excuse to skip the press); then: the
//   page sent exactly one POST /api/check, and after the answer is released the page shows exactly the 4
//   highlights at their offsets — no duplicate — and the count line states exactly 4.
// ROW-118 controls: a single press, held and released the same way, sends one request and draws the 4
//   highlights with a count of 4 — the hold, the drawing and the readings work, and a product with no
//   guard passes it, so only the second press separates them.
// ROW-118 technique: an operation race made deterministic by holding the response (not a timing guess),
//   counted at the network boundary the page uses, with the whole highlight list compared.
// cases: ROW-118 target=ROW-118-a-second-press-while-the-check-runs-sends-no-second-request-and-draws-one-set control=ROW-118-control-a-single-press-sends-one-request-and-draws-one-set

import { expect, test, type Page } from '@playwright/test';
import {
  asActor,
  CHECK_PATH,
  el,
  enterOffer,
  freshNonWord,
  freshRandom,
  openChecker,
  readHighlights,
  ROLES,
  takeCheckSlot,
  type Highlight,
  type Placed,
  type Rng,
} from './harness';
import { isTouch, layout, readCountLine } from './words-helpers';

const WAIT_MS = 15_000;
const shown = (p: Placed): Highlight => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true });

function offerText(rng: Rng) {
  const a = freshNonWord(rng);
  let b = freshNonWord(rng);
  while (b === a) b = freshNonWord(rng);
  let c = freshNonWord(rng);
  while (c === a || c === b) c = freshNonWord(rng);
  const { text, items } = layout(rng, rng.shuffle([a, a, b, c]).map((word) => ({ word })));
  return { text, expected: items.map(shown) };
}

/** Holds every POST /api/check the page sends: forwarded to the product at once, its answer handed back on release(). */
async function holdChecks(page: Page) {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const state = { sent: 0 };
  await page.route(
    (url) => url.pathname === CHECK_PATH,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      state.sent += 1;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    },
  );
  return { state, release: () => open() };
}

async function buttonCentre(page: Page) {
  const button = el(page, ROLES.check).first();
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (!box) throw new Error('setup: the check button has no box on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Raw pointer input at a point: no actionability wait, so a disabled or busy button is pressed all the same. */
async function rawPress(page: Page, at: { x: number; y: number }) {
  if (await isTouch(page)) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** Lets the page run its handlers and send whatever they send, then waits for the route to see it: one round trip, no fixed sleep. */
async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));
}

async function finished(page: Page, text: string) {
  const line = await readCountLine(page);
  return { highlights: await readHighlights(page, text), countLine: { visible: line.visible, numbers: line.numbers } };
}

test('ROW-118-a-second-press-while-the-check-runs-sends-no-second-request-and-draws-one-set', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();

  await test.step('ROW-118 (a): a fast double click or double tap as one gesture', async () => {
    const { text, expected } = offerText(rng);
    await openChecker(page);
    await enterOffer(page, text);
    const hold = await holdChecks(page);
    await takeCheckSlot();
    await takeCheckSlot(); // the slot a wrongly doubled request would spend
    const at = await buttonCentre(page);
    if (await isTouch(page)) {
      await page.touchscreen.tap(at.x, at.y);
      await page.touchscreen.tap(at.x, at.y);
    } else {
      await page.mouse.dblclick(at.x, at.y);
    }
    await expect.poll(() => hold.state.sent, { message: 'ROW-118 (a): the double press sent the check request', timeout: WAIT_MS }).toBeGreaterThanOrEqual(1);
    await settle(page);
    hold.release();
    await expect
      .poll(() => finished(page, text), {
        message: `ROW-118 (a): after a double press the page draws the 4 highlights once, at their places, and states 4 (seed ${rng.seed})`,
        timeout: WAIT_MS,
      })
      .toEqual({ highlights: expected, countLine: { visible: true, numbers: [4] } });
    await settle(page);
    expect(hold.state.sent, 'ROW-118 (a): the double press sent exactly one check request').toBe(1);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  await test.step('ROW-118 (b): a second press while the first check is in flight', async () => {
    const { text, expected } = offerText(rng);
    await openChecker(page);
    await enterOffer(page, text);
    const hold = await holdChecks(page);
    await takeCheckSlot();
    await takeCheckSlot(); // the slot a wrongly doubled request would spend
    const at = await buttonCentre(page);
    await rawPress(page, at);
    await expect.poll(() => hold.state.sent, { message: 'ROW-118 (b): the first press sent the check request', timeout: WAIT_MS }).toBeGreaterThanOrEqual(1);
    await rawPress(page, at);
    await settle(page);
    hold.release();
    await expect
      .poll(() => finished(page, text), {
        message: `ROW-118 (b): after a second press during the check the page draws the 4 highlights once, at their places, and states 4 (seed ${rng.seed})`,
        timeout: WAIT_MS,
      })
      .toEqual({ highlights: expected, countLine: { visible: true, numbers: [4] } });
    await settle(page);
    expect(hold.state.sent, 'ROW-118 (b): the second press while the check ran sent no second request').toBe(1);
  });
});

test('ROW-118-control-a-single-press-sends-one-request-and-draws-one-set', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, expected } = offerText(rng);
  await openChecker(page);
  await enterOffer(page, text);
  const hold = await holdChecks(page);
  await takeCheckSlot();
  await rawPress(page, await buttonCentre(page));
  await expect.poll(() => hold.state.sent, { message: 'ROW-118 control: the press sent the check request', timeout: WAIT_MS }).toBe(1);
  hold.release();
  await expect
    .poll(() => finished(page, text), {
      message: `ROW-118 control: one press draws the 4 highlights at their places and states 4 (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual({ highlights: expected, countLine: { visible: true, numbers: [4] } });
  expect(hold.state.sent, 'ROW-118 control: one press, one request').toBe(1);
});
