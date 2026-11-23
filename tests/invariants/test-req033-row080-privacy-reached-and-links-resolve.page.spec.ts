// Purpose: ROW-080 (REQ-033) — in every browser of the harness, the privacy note is reached by operating
// the privacy-note link in the checker page's footer, and every link on the checker page and on the
// privacy note resolves.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch shell) from ROW-080's
// obligation; links are read from the pages as served and resolved over the network; the near-miss
// unknown path of the control is fresh per run (freshMarker); no expected value comes from the product.
//
// Test argument
// ROW-080 promise: "The privacy note is reached from the footer link of the checker page, and every link
//   on both pages resolves" (the row's own obligation; REQ-033 / A-029: a short privacy note linked from
//   the page footer — "the footer has no link to the note" fails it; D-021: footer, privacy-link,
//   privacy-note).
// ROW-080 wrong product: a footer link whose href is a placeholder ("#", "/privacy" in English, a
//   path the server does not route) so the writer lands on a not-found page or stays put; a link the
//   page's script must intercept and that does nothing when operated; or a note whose own links (back,
//   a #section, a contact mailto) lead nowhere.
// ROW-080 given: the checker page; when: the privacy-note link in its footer is operated (a tap on the
//   phone, a click elsewhere); then: before, no privacy note is on the page; after, the address has left
//   the root and the note (data-element="privacy-note") is shown, at the very address the footer link's
//   href names (a real link, not "#" plus a script); and every <a href> on both pages, read
//   as loaded, resolves — a link to the product's own origin answers 2xx after redirects (and its
//   #fragment names an element on that page), a mailto names well-formed addresses — with at least one
//   link on each page (the footer link, the way back), so the population is never empty.
// ROW-080 honest limit: a link to another host cannot be followed from the harness's internal network
//   (D-023); such a link is held to being a well-formed https address and listed in the test's
//   annotations; its resolution is not proved here.
// ROW-080 controls: the control case shows the link resolver goes red — the root resolves and a fresh
//   unknown path on the product's origin is broken — so a green target is not a resolver that accepts
//   everything.
// ROW-080 technique: before and after around the one real operation (R6: operating a link is the
//   browser's), plus a property over every link of both pages (none is skipped by a sample), with the
//   resolver's discrimination shown by the control; in the harness's four projects.
// cases: ROW-080 target=ROW-080-the-privacy-note-is-reached-from-the-footer-link-and-every-link-on-both-pages-resolves control=ROW-080-control-the-link-resolver-accepts-the-root-and-refuses-an-unknown-path

import { expect, test, type Page } from '@playwright/test';
import { asActor, el, freshMarker, openChecker, PRODUCT_URL, ROLES } from './harness';
import { resolveLink, type LinkVerdict } from './shell-helpers';

const WAIT_MS = 15_000;

async function linksOn(page: Page): Promise<string[]> {
  return page.$$eval('a[href], area[href]', (nodes) => nodes.map((n) => (n.getAttribute('href') ?? '').trim()));
}

test('ROW-080-the-privacy-note-is-reached-from-the-footer-link-and-every-link-on-both-pages-resolves', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
  const checkerUrl = page.url();
  const checkerLinks = await linksOn(page);
  expect(await el(page, ROLES.privacyNote).count(), 'ROW-080: before the footer link is operated, no privacy note is on the page').toBe(0);

  const link = el(page, ROLES.footer).first().locator(`[data-element="${ROLES.privacyLink}"]`).first();
  await expect(link, 'ROW-080: the checker page\'s footer holds the privacy-note link').toBeVisible({ timeout: WAIT_MS });
  const linkHref = ((await link.getAttribute('href')) ?? '').trim();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await link.tap({ timeout: WAIT_MS });
  else await link.click({ timeout: WAIT_MS });

  await expect.poll(() => new URL(page.url()).pathname, { message: 'ROW-080: operating the footer link leaves the checker\'s root address', timeout: WAIT_MS }).not.toBe('/');
  await expect(el(page, ROLES.privacyNote).first(), 'ROW-080: operating the footer link shows the privacy note (data-element="privacy-note")').toBeVisible({ timeout: WAIT_MS });
  const noteUrl = page.url();
  expect(
    linkHref === '' ? null : new URL(linkHref, checkerUrl).pathname,
    'ROW-080: the footer link is a real link to the note it reaches (its href names the note\'s address, not "#" or a script action)',
  ).toBe(new URL(noteUrl).pathname);
  const noteLinks = await linksOn(page);

  expect(checkerLinks.length, 'ROW-080: the checker page carries at least one link (its footer link)').toBeGreaterThan(0);
  expect(noteLinks.length, 'ROW-080: the privacy note carries at least one link (its way back)').toBeGreaterThan(0);

  const verdicts: LinkVerdict[] = [];
  for (const href of checkerLinks) verdicts.push(await resolveLink(page.request, href, checkerUrl));
  for (const href of noteLinks) verdicts.push(await resolveLink(page.request, href, noteUrl));
  for (const v of verdicts.filter((x) => x.verdict === 'outside')) {
    test.info().annotations.push({ type: 'unverified outside link', description: `${v.href} on ${v.from}` });
  }
  expect(
    verdicts.filter((v) => v.verdict === 'broken').map((v) => `${v.href} on ${new URL(v.from).pathname}: ${v.why}`),
    `ROW-080: every link on the checker page (${checkerLinks.length}) and on the privacy note (${noteLinks.length}) resolves`,
  ).toEqual([]);
});

test('ROW-080-control-the-link-resolver-accepts-the-root-and-refuses-an-unknown-path', async ({ page }) => {
  asActor('anonymous');
  const from = PRODUCT_URL + '/';
  const root = await resolveLink(page.request, '/', from);
  const unknown = await resolveLink(page.request, `/${freshMarker()}`, from);
  expect(
    { root: root.verdict, unknown: unknown.verdict },
    'ROW-080 control: the resolver accepts the checker\'s root and refuses a fresh unknown path',
  ).toEqual({ root: 'resolves', unknown: 'broken' });
});
