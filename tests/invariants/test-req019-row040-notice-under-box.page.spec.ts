// Purpose: ledger test for ROW-040 (REQ-019) — before the writer pastes anything, a one-line notice right
// under the text box says the text is checked on our server and is not saved.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the expected
// statement comes from REQ-019 and owner answer A-025, never from the product's source.
//
// Test argument
// ROW-040 promise: REQ-019 (source A-025) — "a one-line notice under the text box says the text is
// ROW-040   checked on our server and is not saved"; D-021 names the notice's identifier, `notice`.
// ROW-040 wrong product: the notice is missing; or it sits in the footer, far from the box; or it says
// ROW-040   only "Revisamos tu texto en el servidor" (no word that it is not saved); or it says the text
// ROW-040   is checked "en un servidor externo"; or it is a paragraph of several sentences.
// ROW-040 given: the checker page freshly opened, nothing typed. when: the page has loaded. then: one
// ROW-040   element data-element="notice" is visible; its box starts at or below the bottom of the text
// ROW-040   box and overlaps it horizontally, outside the footer, with no visible control between the two but
// ROW-040   the check and copy buttons; its text is
// ROW-040   one sentence on no more than one line break-free run; it names our own server ("nuestro
// ROW-040   servidor" / "nuestros servidores" / "servidor propio") and states the text is not kept (a
// ROW-040   negation followed by guardar / almacenar / conservar / registrar).
// ROW-040 controls: the control case opens the page and finds the box and the check button, so a red
// ROW-040   target is about the notice, never about a page that did not load.
// ROW-040 technique: one exact element (the D-021 identifier), its geometry against the box, and its
// ROW-040   wording read accent- and case-insensitively; decoys are the near misses above — "se guarda"
// ROW-040   without a negation, a server not ours — each of which the patterns refuse.
// ROW-040 cases: ROW-040 target=tests/invariants/test-req019-row040-notice-under-box.page.spec.ts::[chromium]ROW-040_the_notice_under_the_box_says_the_text_is_checked_on_our_server_and_not_saved control=tests/invariants/test-req019-row040-notice-under-box.page.spec.ts::[chromium]ROW-040_control:_the_checker_page_shows_its_box_and_its_button

import { expect, test } from '@playwright/test';
import { asActor, el, openChecker, ROLES } from './harness';
import { NOT_KEPT, plainReading } from './privacy-page-helpers';

const OUR_SERVER = /\bnuestros? servidor(es)?\b|\bservidor(es)? propios?\b|\bpropios? servidor(es)?\b/;

test('ROW-040 control: the checker page shows its box and its button', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
});

test('ROW-040 the notice under the box says the text is checked on our server and not saved', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);

  const notice = el(page, ROLES.notice);
  await expect(notice, 'the page carries exactly one notice (data-element="notice")').toHaveCount(1);
  await expect(notice, 'the notice is visible before anything is typed').toBeVisible();

  // Under the text box: starts at or below the box's bottom edge, overlapping it horizontally, and no
  // other visible control (button, link, field) stands between them.
  const geometry = await page.evaluate(() => {
    const box = document.querySelector('[data-element="offer"]')!.getBoundingClientRect();
    const n = document.querySelector('[data-element="notice"]')!.getBoundingClientRect();
    const between = Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]'))
      .filter((c) => {
        const r = c.getBoundingClientRect();
        const shown = r.width > 0 && r.height > 0 && getComputedStyle(c).visibility !== 'hidden';
        const own = c.closest('[data-element="check"], [data-element="copy"]');
        return shown && !own && r.top >= box.bottom - 1 && r.bottom <= n.top + 1 && r.right > n.left && r.left < n.right;
      })
      .map((c) => c.getAttribute('data-element') ?? c.tagName.toLowerCase());
    return {
      boxBottom: box.bottom,
      noticeTop: n.top,
      overlap: Math.min(box.right, n.right) - Math.max(box.left, n.left),
      between,
      inFooter: document.querySelector('[data-element="notice"]')!.closest('[data-element="footer"]') !== null,
    };
  });
  expect(geometry.noticeTop, 'ROW-040: the notice starts at or below the bottom of the text box').toBeGreaterThanOrEqual(geometry.boxBottom - 1);
  expect(geometry.overlap, 'ROW-040: the notice stands under the text box (they overlap horizontally)').toBeGreaterThan(0);
  expect(geometry.between, 'ROW-040: no control but the check and copy buttons stands between the text box and the notice').toEqual([]);
  expect(geometry.inFooter, 'ROW-040: the notice is under the box, not in the page footer').toBe(false);

  // One line: one sentence, no line break inside it.
  const raw = (await notice.innerText()).trim();
  expect(raw, 'ROW-040: the notice is one line — no line break inside it').not.toMatch(/\n/);
  const sentences = raw.split(/(?<=[.!?])\s+(?=\S)/).filter((s) => s.trim().length > 0);
  expect(sentences, 'ROW-040: the notice is a single sentence').toHaveLength(1);

  const said = plainReading(raw);
  expect(said, 'ROW-040: the notice says the text is checked on our own server').toMatch(OUR_SERVER);
  expect(said, 'ROW-040: the notice says the text is not saved').toMatch(NOT_KEPT);
});
