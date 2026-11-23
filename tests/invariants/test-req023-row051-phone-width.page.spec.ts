// Purpose: ROW-051 (REQ-023) — at a phone width of 360 pixels, in every browser of the harness, every
// control the page draws is reachable and the page does not scroll sideways: before a check, after a
// check with a flagged word and a long link in the offer, and with the flagged word's menu opened.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-023's
// fail-if and A-014; the offer's non-word and link are fresh per run.
//
// Test argument
// ROW-051 promise: "at a phone width of 360 pixels any control is unreachable or the page scrolls
//   sideways" fails REQ-023 (fail-if arm 2; A-014 "the page works on a phone as well as on a computer").
// ROW-051 wrong product: a layout with a fixed or minimum width over 360 px; a page with no
//   width=device-width viewport, laid out 980 px wide on a phone; a highlight copy of the text with
//   white-space: pre or nowrap that a long link pushes past the right edge; a suggestion menu positioned
//   to the right of the word and drawn off-screen; a control covered by another element.
// ROW-051 given: a 360 x 740 viewport; an offer holding a fresh non-word and an 80-character link with
//   no break opportunity; when: the page is measured as loaded, then after Revisar ortografía (the word
//   highlighted), then after the highlighted word is pressed (its menu open); then: in each state the
//   layout viewport is at most 360 px wide, the document is no wider than it and cannot be scrolled
//   sideways, and every rendered control (links, buttons, fields, the D-021 controls, the highlights and
//   whatever the menu draws) lies within the 360 px once scrolled into view vertically and is the
//   element hit at one of its points (not covered).
// ROW-051 controls: the control case measures the page as loaded — the measure runs and finds the box
//   and the button; in the target the highlight is observed on the non-word and pressing it adds
//   controls, so the states where most controls exist are really reached.
// ROW-051 technique: a property over every control of each state (never a hand-picked list), with the
//   long unbreakable link as the decoy that only overflows a wrong layout; the browser is the boundary
//   because reachability is paint and operation.
// cases: ROW-051 target=ROW-051-at-360-pixels-after-a-check-and-with-the-flag-menu-open-every-control-is-reachable-and-nothing-scrolls-sideways control=ROW-051-at-360-pixels-the-page-as-loaded-has-every-control-reachable-and-no-sideways-scroll

import { expect, test, type Page } from '@playwright/test';
import { ROLES, asActor, el, enterOffer, fillerWords, freshNonWord, freshRandom, openChecker, pressCheck, readHighlights } from './harness';

const PHONE_WIDTH = 360;
test.use({ viewport: { width: PHONE_WIDTH, height: 740 } });

type Control = { what: string; left: number; right: number; inside: boolean; hit: boolean };
type Reach = { innerWidth: number; documentWidth: number; scrolledSideways: number; controls: Control[] };

/**
 * One evaluation: the layout width, the document width, a sideways-scroll attempt, and every rendered
 * control's reach. With `scroll` false it only lists the rendered controls (no scrolling, no hit test).
 */
async function measure(page: Page, scroll = true): Promise<Reach> {
  return page.evaluate((scroll: boolean) => {
    const SELECTOR = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[contenteditable=""]',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
      '[data-element="offer"]',
      '[data-element="check"]',
      '[data-element="copy"]',
      '[data-element="flag"]',
      '[data-element="privacy-link"]',
      '[data-element="back"]',
    ].join(',');
    const rendered = (e: HTMLElement) => {
      if (e.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const describe = (e: HTMLElement) => {
      const de = e.getAttribute('data-element');
      const label = (e.innerText || e.getAttribute('aria-label') || e.getAttribute('value') || '').trim().slice(0, 30);
      return `${e.tagName.toLowerCase()}${de ? `[data-element=${de}]` : ''} "${label}"`;
    };
    const doc = document.documentElement;
    if (!scroll) {
      const listed = Array.from(new Set(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)))).filter(rendered);
      return { innerWidth: window.innerWidth, documentWidth: doc.scrollWidth, scrolledSideways: 0, controls: listed.map((e) => ({ what: describe(e), left: 0, right: 0, inside: true, hit: true })) };
    }
    const y0 = window.scrollY;
    window.scrollTo(100_000, y0);
    const scrolledSideways = window.scrollX;
    window.scrollTo(0, y0);
    const controls: { what: string; left: number; right: number; inside: boolean; hit: boolean }[] = [];
    const all = Array.from(new Set(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)))).filter(rendered);
    for (const e of all) {
      e.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = e.getBoundingClientRect();
      const inside = r.left >= -0.5 && r.right <= window.innerWidth + 0.5 && window.scrollX === 0;
      const inset = (a: number, b: number) => Math.min(4, (b - a) / 2);
      const xs = [r.left + r.width / 2, r.left + inset(r.left, r.right), r.right - inset(r.left, r.right)];
      const ys = [r.top + r.height / 2, r.top + inset(r.top, r.bottom), r.bottom - inset(r.top, r.bottom)];
      let hit = false;
      for (const x of xs) {
        for (const y of ys) {
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
          const h = document.elementFromPoint(x, y);
          if (h && (h === e || e.contains(h))) hit = true;
        }
      }
      controls.push({ what: describe(e), left: Math.round(r.left), right: Math.round(r.right), inside, hit });
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    }
    window.scrollTo(0, 0);
    return { innerWidth: window.innerWidth, documentWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), scrolledSideways, controls };
  }, scroll);
}

function verdict(state: string, m: Reach) {
  return {
    state,
    laidOutAtPhoneWidth: m.innerWidth <= PHONE_WIDTH,
    noSidewaysScroll: m.documentWidth <= m.innerWidth && m.scrolledSideways === 0,
    unreachable: m.controls.filter((c) => !c.inside || !c.hit).map((c) => `${c.what} at ${c.left}..${c.right}${c.hit ? '' : ' (covered)'}`),
  };
}

const fine = (state: string) => ({ state, laidOutAtPhoneWidth: true, noSidewaysScroll: true, unreachable: [] });

test('ROW-051-at-360-pixels-the-page-as-loaded-has-every-control-reachable-and-no-sideways-scroll', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
  const m = await measure(page);
  expect(m.controls.some((c) => c.what.includes('data-element=offer')) && m.controls.some((c) => c.what.includes('data-element=check')), 'ROW-051 setup: the measure finds the box and the button').toBe(true);
  expect(verdict('as loaded', m), `ROW-051: as loaded at 360 px (layout ${m.innerWidth} px, document ${m.documentWidth} px)`).toEqual(fine('as loaded'));
});

test('ROW-051-at-360-pixels-after-a-check-and-with-the-flag-menu-open-every-control-is-reachable-and-nothing-scrolls-sideways', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const fillers = fillerWords();
  const nonWord = freshNonWord(rng);
  let link = 'https://empleo.example/ofertas/';
  while (link.length < 80) link += 'abcdefghijklmnopqrstuvwxyz'[rng.int(26)];
  const text = [rng.pick(fillers), rng.pick(fillers), nonWord, rng.pick(fillers), link, rng.pick(fillers), rng.pick(fillers)].join(' ');

  await openChecker(page);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, 'ROW-051: the check is answered').toBe(200);
  await expect
    .poll(async () => (await readHighlights(page, text)).map((h) => h.word), { message: `ROW-051: after the check, "${nonWord}" is highlighted (the post-check controls exist)`, timeout: 15_000 })
    .toContain(nonWord);
  const afterCheck = await measure(page);
  expect(verdict('after a check', afterCheck), `ROW-051: after a check at 360 px (layout ${afterCheck.innerWidth} px, document ${afterCheck.documentWidth} px)`).toEqual(fine('after a check'));

  const flag = el(page, ROLES.flag).filter({ hasText: nonWord }).first();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await flag.tap({ timeout: 15_000 });
  else await flag.click({ timeout: 15_000 });
  await expect
    .poll(async () => (await measure(page, false)).controls.length, { message: 'ROW-051: pressing the highlighted word opens its controls (suggestions, Ignore)', timeout: 10_000 })
    .toBeGreaterThan(afterCheck.controls.length);
  const menuOpen = await measure(page);
  expect(verdict('with the flag menu open', menuOpen), `ROW-051: with the flag's menu open at 360 px (layout ${menuOpen.innerWidth} px, document ${menuOpen.documentWidth} px)`).toEqual(
    fine('with the flag menu open'),
  );
});
