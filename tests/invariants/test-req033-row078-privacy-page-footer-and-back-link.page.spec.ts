// Purpose: ROW-078 (REQ-033) — in every browser of the harness, the privacy-note page carries the shell's
// footer (the same contact email address as the checker page's footer, and the privacy-note link) and a
// link back that, operated, lands on the checker.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch shell) from ROW-078's
// obligation; elements are found by their D-021 identifiers, the privacy note's address is the route
// table's (GET /privacidad), and the expected footer address is read from the checker page the back link
// lands on — never from the product's source.
//
// Test argument
// ROW-078 promise: "The privacy-note page has the shell's footer and a link back to the checker" (the
//   row's own obligation; REQ-033 / A-029: the note is linked from the page footer; REQ-028 / A-023: the
//   footer shows a contact email address; D-021: privacy-note, back, footer, privacy-link).
// ROW-078 wrong product: a privacy note served as a bare document — no footer, or a footer of its own
//   with a different (or no) contact address, or no way back but the browser's back button; or a "back"
//   link whose href is "#" or the note itself, so operating it leaves the writer on the note.
// ROW-078 given: the privacy note at its address; when: it is opened, then its back link is operated (a
//   tap on the phone, a click elsewhere); then: before the operation the note (data-element="privacy-note")
//   is visible, the checker's text box is absent, and the footer is visible, shows an email address and
//   holds the privacy-note link; after it, the address is the root, the checker's text box and check
//   button are visible, and the checker page's footer shows the same email address the note's footer
//   showed — one shell footer, not two.
// ROW-078 controls: the control case shows GET /privacidad answers 200 in this browser — the route is
//   reached, so a red target is about the page's footer and link, not a missing route.
// ROW-078 technique: before and after around the one operation, on the real control through the engine
//   door (R6: operating a link is the browser's), with the footer compared against the checker page's
//   own footer (the near-miss: a footer that merely exists, with another address, fails); in the
//   harness's four projects.
// cases: ROW-078 target=ROW-078-the-privacy-note-page-has-the-shell-footer-and-a-link-back-to-the-checker control=ROW-078-control-the-privacy-route-answers-200

import { expect, test } from '@playwright/test';
import { asActor, el, ROLES } from './harness';
import { EMAIL_RE } from './shell-helpers';

const WAIT_MS = 15_000;
const PRIVACY_PATH = '/privacidad';

test('ROW-078-the-privacy-note-page-has-the-shell-footer-and-a-link-back-to-the-checker', async ({ page }) => {
  asActor('anonymous');
  const nav = await page.goto(PRIVACY_PATH, { waitUntil: 'load' });
  expect(nav?.status(), 'ROW-078: the privacy note answers 200').toBe(200);

  await expect(el(page, ROLES.privacyNote).first(), 'ROW-078: the privacy note (data-element="privacy-note") is shown').toBeVisible({ timeout: WAIT_MS });
  expect(await el(page, ROLES.offer).count(), 'ROW-078: before the back link is operated, the checker\'s text box is not on the page').toBe(0);

  // The shell's footer on the note.
  const footer = el(page, ROLES.footer).first();
  await expect(footer, 'ROW-078: the privacy note carries the footer (data-element="footer")').toBeVisible({ timeout: WAIT_MS });
  const noteFooterText = (await footer.innerText()).trim();
  const noteAddress = EMAIL_RE.exec(noteFooterText)?.[0] ?? null;
  expect(noteAddress, `ROW-078: the note's footer ${JSON.stringify(noteFooterText)} shows the contact email address`).not.toBeNull();
  await expect(
    footer.locator(`[data-element="${ROLES.privacyLink}"]`).first(),
    'ROW-078: the note\'s footer holds the privacy-note link, as the shell\'s footer does',
  ).toBeVisible({ timeout: WAIT_MS });

  // The link back, operated.
  const back = el(page, ROLES.back).first();
  await expect(back, 'ROW-078: the note shows a link back to the checker (data-element="back")').toBeVisible({ timeout: WAIT_MS });
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await back.tap({ timeout: WAIT_MS });
  else await back.click({ timeout: WAIT_MS });

  await expect.poll(() => new URL(page.url()).pathname, { message: 'ROW-078: the back link leads to the checker\'s root address', timeout: WAIT_MS }).toBe('/');
  await expect(el(page, ROLES.offer).first(), 'ROW-078: after the back link, the checker\'s text box is shown').toBeVisible({ timeout: WAIT_MS });
  await expect(el(page, ROLES.check).first(), 'ROW-078: after the back link, the check button is shown').toBeVisible({ timeout: WAIT_MS });

  // One shell footer: the checker page's footer shows the same contact address.
  const checkerFooter = el(page, ROLES.footer).first();
  await expect(checkerFooter, 'ROW-078: the checker page carries the footer the note\'s footer must match').toBeVisible({ timeout: WAIT_MS });
  const checkerAddress = EMAIL_RE.exec((await checkerFooter.innerText()).trim())?.[0] ?? null;
  expect(noteAddress, 'ROW-078: the note\'s footer shows the same contact address as the checker page\'s footer').toBe(checkerAddress);
});

test('ROW-078-control-the-privacy-route-answers-200', async ({ page }) => {
  asActor('anonymous');
  const nav = await page.goto(PRIVACY_PATH, { waitUntil: 'load' });
  expect(nav?.status(), 'ROW-078 control: GET /privacidad answers 200').toBe(200);
});
