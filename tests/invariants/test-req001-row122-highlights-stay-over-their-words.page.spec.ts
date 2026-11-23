// Purpose: ROW-122 (REQ-001) — on the checker page, in every browser of the harness, each highlight stays
// drawn over its own word in the box after the page's web font finishes loading, after the box and the
// page scroll, after a resize, a rotation, the soft keyboard opening, and a 200% zoom.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); misspellings are fresh
// non-words (harness freshNonWord, checked against dictionary-es 4.0.0); where a word is drawn is measured
// from the box's own computed layout (words-helpers measureAlignment), never from the product's code.
//
// Test argument
// ROW-122 promise: highlights stay over their own words after scrolling, rotation, opening the soft
//   keyboard, resizing, 200% zoom and the font finishing loading (ROW-122, origin domain; REQ-001: "a
//   flagged word is highlighted anywhere but at its own position" fails; D-028: a highlight is a
//   data-element="flag" element inside the element that shows the offer's text).
// ROW-122 wrong product: highlights drawn on a layer over the text box whose positions are computed once,
//   when the check answers — the layer does not follow the box's scroll, re-wrap on a narrower viewport,
//   or re-measure when the web font swaps in, so after any of them the marks sit over other words or
//   empty space while the list of highlighted words is still right.
// ROW-122 given: a long offer (36 short lines, a fresh non-word on every other line, so any window of the
//   box shows highlights, and the box must scroll); the page's web-font responses held back by the test
//   until after the check has drawn; when: the check is pressed and drawn, then, one after the other:
//   the held fonts are delivered; the box is scrolled to its middle and the page scrolled; the viewport
//   is narrowed; rotated (width and height swapped); the box is focused and the viewport shortened as the
//   soft keyboard does; the viewport is halved in both directions as a 200% zoom does to the page's CSS
//   size; and the original size is restored; then: after each, every highlight whose word is inside the
//   visible part of the box is drawn over that word (centre within half a character across and 35% of a
//   line down, width within 25%) — at least one is compared every time — and at the end the highlights
//   are still exactly the misspellings at their offsets.
// ROW-122 controls: the control case checks alignment right after drawing with nothing changed — the
//   check, the drawing and the measurement work, and a layer positioned once passes it, so only the
//   perturbations separate a following layer from a frozen one.
// ROW-122 technique: paint is the browser's, so the engine door; each perturbation is a step with its own
//   measurement, polled (a page may re-position on the next frame) rather than slept on. Honest limits:
//   Playwright cannot rotate a device, open a real soft keyboard or use the browser's zoom; the steps
//   reproduce what each does to the page's layout (viewport swap, viewport shortened with the box
//   focused, CSS viewport halved) — not the device-pixel ratio of a real zoom. A page with no web font
//   makes the font step a re-measurement (recorded as the `fonts-held` annotation).
// cases: ROW-122 target=ROW-122-highlights-stay-over-their-words-after-font-load-scroll-resize-rotation-keyboard-and-zoom control=ROW-122-control-highlights-are-over-their-words-when-drawn

import { expect, test, type Page, type Route } from '@playwright/test';
import {
  asActor,
  compose,
  el,
  enterOffer,
  fillerWords,
  freshNonWord,
  freshRandom,
  openChecker,
  pressCheck,
  readHighlights,
  ROLES,
  type Highlight,
  type Rng,
} from './harness';
import { alignmentVerdict, measureAlignment } from './words-helpers';

const WAIT_MS = 15_000;
const ALIGN_WAIT_MS = 5_000;

function longOffer(rng: Rng) {
  const fillers = fillerWords();
  const misspelled = new Set<string>();
  const tokens: string[] = [];
  const seps: string[] = [];
  const lines = 36;
  for (let line = 0; line < lines; line++) {
    const words: string[] = [];
    if (line % 2 === 0) {
      let w = freshNonWord(rng);
      while (misspelled.has(w)) w = freshNonWord(rng);
      misspelled.add(w);
      words.push(...(rng.int(2) === 0 ? [w, rng.pick(fillers)] : [rng.pick(fillers), w]));
    } else {
      words.push(rng.pick(fillers), rng.pick(fillers));
    }
    words.forEach((w, i) => {
      if (tokens.length) seps.push(i === 0 ? '\n' : ' ');
      tokens.push(w);
    });
  }
  const { text, placed } = compose(tokens, seps);
  const expected: Highlight[] = placed
    .filter((p) => misspelled.has(p.word))
    .map((p) => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true }));
  return { text, expected };
}

async function expectAligned(page: Page, text: string, after: string, seed: number, bringBoxIntoView = true) {
  // after a viewport change the box may stand outside the view; bring it in (an ordinary scroll) so some highlight is compared
  if (bringBoxIntoView) await el(page, ROLES.offer).first().evaluate((e) => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await expect
    .poll(async () => alignmentVerdict(await measureAlignment(page, text)), {
      message: `ROW-122: after ${after}, every highlight in view is drawn over its own word (seed ${seed})`,
      timeout: ALIGN_WAIT_MS,
    })
    .toEqual({ error: null, someHighlightInView: true, misaligned: [] });
}

test('ROW-122-highlights-stay-over-their-words-after-font-load-scroll-resize-rotation-keyboard-and-zoom', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, expected } = longOffer(rng);
  const size = page.viewportSize();
  if (!size) throw new Error('setup: the engine reports no viewport size');
  const { width: w0, height: h0 } = size;

  const held: Route[] = [];
  let fontsFree = false;
  await page.route('**/*', async (route) => {
    if (!fontsFree && route.request().resourceType() === 'font') held.push(route);
    else await route.continue();
  });
  const freeFonts = async () => {
    fontsFree = true;
    for (const r of held.splice(0)) await r.continue().catch(() => undefined);
  };

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(el(page, ROLES.offer), 'ROW-122 setup: the checker page shows its text box').toBeVisible({ timeout: WAIT_MS });
    await expect(el(page, ROLES.check), 'ROW-122 setup: the checker page shows its check button').toBeVisible({ timeout: WAIT_MS });
    await enterOffer(page, text);
    expect((await pressCheck(page)).status, "ROW-122: the page's check request is answered").toBe(200);
    await expect
      .poll(() => readHighlights(page, text), {
        message: `ROW-122: every misspelling of the long offer is highlighted where it stands (seed ${rng.seed})`,
        timeout: WAIT_MS,
      })
      .toEqual(expected);
    await expectAligned(page, text, 'drawing, before the web font arrives', rng.seed);

    await test.step('ROW-122: the font finishes loading', async () => {
      test.info().annotations.push({ type: 'fonts-held', description: String(held.length) });
      await freeFonts();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expectAligned(page, text, 'the web font finished loading', rng.seed);
    });

    await test.step('ROW-122: scrolling the box and the page', async () => {
      await el(page, ROLES.offer).first().evaluate((e) => {
        e.scrollTop = Math.max(0, (e.scrollHeight - e.clientHeight) / 2);
      });
      await expectAligned(page, text, 'scrolling the box to its middle', rng.seed);
      await page.evaluate(() => {
        const s = document.scrollingElement;
        if (s) window.scrollBy(0, Math.min(120, Math.max(0, s.scrollHeight - window.innerHeight)));
      });
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
      await expectAligned(page, text, 'scrolling the page', rng.seed, false);
    });

    await test.step('ROW-122: resizing', async () => {
      await page.setViewportSize({ width: Math.round(w0 * 0.7), height: h0 });
      await expectAligned(page, text, 'narrowing the window', rng.seed);
    });

    await test.step('ROW-122: rotation', async () => {
      await page.setViewportSize({ width: h0, height: w0 });
      await expectAligned(page, text, 'rotating (width and height swapped)', rng.seed);
    });

    await test.step('ROW-122: the soft keyboard opening', async () => {
      await page.setViewportSize({ width: w0, height: h0 });
      await el(page, ROLES.offer).first().focus();
      await page.setViewportSize({ width: w0, height: Math.round(h0 * 0.55) });
      await expectAligned(page, text, 'the soft keyboard taking the lower part of the screen', rng.seed);
    });

    await test.step('ROW-122: 200% zoom', async () => {
      await page.setViewportSize({ width: Math.round(w0 / 2), height: Math.round(h0 / 2) });
      await expectAligned(page, text, 'zooming to 200% (half the CSS width and height)', rng.seed);
    });

    await test.step('ROW-122: back to the original size', async () => {
      await page.setViewportSize({ width: w0, height: h0 });
      await expectAligned(page, text, 'returning to the original size', rng.seed);
      expect(await readHighlights(page, text), `ROW-122: after all of it the highlights are still exactly the misspellings at their offsets (seed ${rng.seed})`).toEqual(expected);
    });
  } finally {
    await freeFonts();
  }
});

test('ROW-122-control-highlights-are-over-their-words-when-drawn', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, expected } = longOffer(rng);
  await openChecker(page);
  await enterOffer(page, text);
  expect((await pressCheck(page)).status, "ROW-122 control: the page's check request is answered").toBe(200);
  await expect
    .poll(() => readHighlights(page, text), {
      message: `ROW-122 control: every misspelling is highlighted where it stands (seed ${rng.seed})`,
      timeout: WAIT_MS,
    })
    .toEqual(expected);
  await expectAligned(page, text, 'drawing, nothing changed', rng.seed);
});
