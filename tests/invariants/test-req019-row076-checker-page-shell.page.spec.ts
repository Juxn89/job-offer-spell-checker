// Purpose: ROW-076 (REQ-019, REQ-028, REQ-033) — in every browser of the harness, the checker page's
// shell is Spanish and whole: its title, the text box, the check and copy buttons, the privacy notice
// under the box, and a footer showing a contact email address and the privacy-note link; and the page
// logs no console error while it loads.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch shell) from ROW-076's
// obligation; Spanish is judged by the dictionary oracle (dictionary-es 4.0.0, D-029), elements are
// found by their D-021 identifiers, and no expected value comes from the product.
//
// Test argument
// ROW-076 promise: "The page shell in Spanish: title, text box, Check spelling, Copy text, the privacy
//   notice, and a footer with the contact address and the privacy-note link; no console error on load"
//   (the row's own obligation; REQ-019 / A-025: a one-line notice under the text box; REQ-028 / A-023:
//   the footer shows a contact email address; REQ-033 / A-029: the privacy note is linked from the
//   footer; D-021: the identifiers offer, check, copy, notice, footer, privacy-link).
// ROW-076 wrong product: a page whose buttons read "Check spelling" and "Copy text" (the PRD's English
//   names copied onto the page), or one without the copy button, or with the privacy link outside the
//   footer and no contact address, or a notice placed above the box; or a page whose script throws on
//   load (a console error the writer never sees but which breaks a later control).
// ROW-076 given: the checker page at its root; when: it is opened in each browser and has finished
//   loading; then: <html lang> is Spanish; the document title, both button labels, the notice and the
//   footer hold only words the Spanish dictionary holds; the box is visible and editable; the two
//   buttons are visible and differently labelled; the notice is visible and starts below the box's
//   bottom edge; the footer is visible, shows an email address in its text, and holds the privacy link
//   (visible, labelled in Spanish, with an href); and no console error, uncaught page error, failed
//   request or error answer to the page's own requests was seen from before navigation to idle.
// ROW-076 controls: the control case opens the page through the harness's openChecker (the box and the
//   check button are visible) — the page loads in this browser, so a red target is about the shell.
// ROW-076 technique: one loaded page per browser, every shell part asserted softly so one run lists
//   every gap; Spanish judged by the independent dictionary oracle, not by one wording (any Spanish
//   label passes, English fails); placement read from the boxes (the notice's top against the box's
//   bottom); browser boundary because console errors and placement are paint and load (R6), in the
//   harness's four projects.
// cases: ROW-076 target=ROW-076-the-checker-page-shell-is-spanish-with-its-controls-notice-and-footer control=ROW-076-control-the-checker-page-answers-and-shows-its-text-box

import { expect, test, type Locator } from '@playwright/test';
import { asActor, el, openChecker, ROLES } from './harness';
import { EMAIL_RE, spanishReading } from './shell-helpers';

const WAIT_MS = 15_000;

async function label(loc: Locator): Promise<string> {
  return (
    (await loc.evaluate((n) => {
      const e = n as HTMLElement & { value?: string };
      const own = (e.innerText ?? '').trim();
      if (own) return own;
      const aria = e.getAttribute('aria-label') ?? '';
      if (aria.trim()) return aria.trim();
      return typeof e.value === 'string' ? e.value.trim() : '';
    })) ?? ''
  );
}

test('ROW-076-the-checker-page-shell-is-spanish-with-its-controls-notice-and-footer', async ({ page }) => {
  asActor('anonymous');
  const loadErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') loadErrors.push(`console error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => loadErrors.push(`uncaught page error: ${err.message}`));
  page.on('requestfailed', (req) => loadErrors.push(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText ?? 'no reason'})`));
  page.on('response', (res) => {
    if (res.status() >= 400) loadErrors.push(`error answer: ${res.status()} to ${res.request().method()} ${res.url()}`);
  });

  const nav = await page.goto('/', { waitUntil: 'load' });
  expect(nav?.status(), 'ROW-076: the checker page answers 200 at its root').toBe(200);
  await page.waitForLoadState('networkidle', { timeout: WAIT_MS }).catch(() => undefined);

  // Language and title.
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect.soft(lang, 'ROW-076: the page declares Spanish (<html lang="es…">)').toMatch(/^es\b/i);
  const title = (await page.title()).trim();
  expect.soft(title, 'ROW-076: the page has a title').not.toBe('');
  expect.soft(spanishReading(title).foreign, `ROW-076: the title ${JSON.stringify(title)} is Spanish`).toEqual([]);

  // The text box.
  const offer = el(page, ROLES.offer).first();
  await expect.soft(offer, 'ROW-076: the text box (data-element="offer") is visible').toBeVisible({ timeout: WAIT_MS });
  await expect.soft(offer, 'ROW-076: the text box is editable').toBeEditable({ timeout: WAIT_MS });

  // Check spelling and Copy text.
  const labels: Record<string, string> = {};
  for (const role of [ROLES.check, ROLES.copy]) {
    const button = el(page, role).first();
    await expect.soft(button, `ROW-076: the ${role} button (data-element="${role}") is visible`).toBeVisible({ timeout: WAIT_MS });
    if ((await button.count()) === 0) continue;
    const text = await label(button);
    labels[role] = text;
    expect.soft(text, `ROW-076: the ${role} button has a label`).not.toBe('');
    expect.soft(spanishReading(text).foreign, `ROW-076: the ${role} button's label ${JSON.stringify(text)} is Spanish`).toEqual([]);
  }
  if (labels.check && labels.copy) {
    expect.soft(labels.check, 'ROW-076: the check and copy buttons are labelled differently').not.toBe(labels.copy);
  }

  // The privacy notice, under the text box.
  const notice = el(page, ROLES.notice).first();
  await expect.soft(notice, 'ROW-076: the privacy notice (data-element="notice") is visible').toBeVisible({ timeout: WAIT_MS });
  if ((await notice.count()) > 0) {
    const text = (await notice.innerText()).trim();
    expect.soft(text, 'ROW-076: the notice has text').not.toBe('');
    expect.soft(spanishReading(text).foreign, `ROW-076: the notice ${JSON.stringify(text)} is Spanish`).toEqual([]);
    const boxBox = (await offer.count()) > 0 ? await offer.boundingBox() : null;
    const noticeBox = await notice.boundingBox();
    if (boxBox && noticeBox) {
      expect.soft(noticeBox.y, 'ROW-076: the notice starts below the text box (REQ-019: under the text box)').toBeGreaterThanOrEqual(boxBox.y + boxBox.height - 1);
    }
  }

  // The footer: a contact email address and the privacy-note link.
  const footer = el(page, ROLES.footer).first();
  await expect.soft(footer, 'ROW-076: the footer (data-element="footer") is visible').toBeVisible({ timeout: WAIT_MS });
  if ((await footer.count()) > 0) {
    const text = (await footer.innerText()).trim();
    expect.soft(text, `ROW-076: the footer ${JSON.stringify(text)} shows a contact email address`).toMatch(EMAIL_RE);
    expect.soft(spanishReading(text).foreign, `ROW-076: the footer ${JSON.stringify(text)} is Spanish`).toEqual([]);
    const link = footer.locator(`[data-element="${ROLES.privacyLink}"]`).first();
    await expect.soft(link, 'ROW-076: the privacy-note link (data-element="privacy-link") is in the footer and visible').toBeVisible({ timeout: WAIT_MS });
    if ((await link.count()) > 0) {
      const linkText = await label(link);
      expect.soft(linkText, 'ROW-076: the privacy-note link has a label').not.toBe('');
      expect.soft(spanishReading(linkText).foreign, `ROW-076: the privacy-note link's label ${JSON.stringify(linkText)} is Spanish`).toEqual([]);
      expect.soft(await link.getAttribute('href'), 'ROW-076: the privacy-note link is a link (it has an href)').toBeTruthy();
    }
  }

  // No console error on load.
  expect(loadErrors, 'ROW-076: no console error, page error, failed request or error answer while the page loads').toEqual([]);
});

test('ROW-076-control-the-checker-page-answers-and-shows-its-text-box', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
});
