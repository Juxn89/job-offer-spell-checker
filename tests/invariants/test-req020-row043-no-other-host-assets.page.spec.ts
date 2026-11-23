// Purpose: ledger test for ROW-043 (REQ-020) — the checker page loads no script, font, style or image
// from any other host, on load or while a check runs and is drawn.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from REQ-020 and owner answer A-024, never from the product's source.
//
// Test argument
// ROW-043 promise: REQ-020 (A-024) — "the page loads no script, font, style or image from another host".
// ROW-043 wrong product: the stylesheet @imports a Google Fonts family or @font-face points at a font CDN;
// ROW-043   a script tag pulls a library from a CDN (jsdelivr, unpkg); the highlight style uses a
// ROW-043   background-image from another host; a <link rel="preconnect"> or icon points elsewhere; the
// ROW-043   result drawing lazily loads an icon from another host only once a check is shown.
// ROW-043 given: a fresh browser context recording every request from the first navigation; a fresh offer
// ROW-043   with one known misspelling (the dictionary oracle), so the result-drawing path is exercised.
// ROW-043 when: the page is loaded, the offer entered, the check pressed and its highlight drawn.
// ROW-043 then: every request the page made (document, script, style, font, image, media, fetch) went to
// ROW-043   the product's own origin (data: and blob: are the page's own); and every resource reference in
// ROW-043   the drawn DOM — script src, link href (stylesheet, preload, preconnect, icon, …), img/source
// ROW-043   src and srcset, iframe, video, audio, object, embed — resolves to the product's own origin.
// ROW-043 controls: the control case shows the recorder sees the page's own document request (an empty
// ROW-043   record cannot pass); inside the target, the drawn misspelling shows the result path was reached
// ROW-043   before the record is read.
// ROW-043 technique: the whole population of requests over the session plus the DOM's references (which
// ROW-043   catch a reference the internal network refused before it became a response), rather than a
// ROW-043   list of known CDNs; the near miss a CDN-name list would let pass is any unlisted host.
// ROW-043 cases: ROW-043 target=tests/invariants/test-req020-row043-no-other-host-assets.page.spec.ts::[chromium]ROW-043_the_page_loads_nothing_from_another_host,_on_load_or_while_a_check_is_drawn control=tests/invariants/test-req020-row043-no-other-host-assets.page.spec.ts::[chromium]ROW-043_control:_the_recorder_sees_the_page's_own_document_request

import { expect, test, type Page } from '@playwright/test';
import { asActor, enterOffer, freshRandom, openChecker, pressCheck, PRODUCT_URL } from './harness';
import { expectMisspellingShown, misspelledOffer } from './privacy-page-helpers';

function record(page: Page) {
  const requests: { url: string; type: string }[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), type: r.resourceType() }));
  return requests;
}

const foreign = (url: string, own: string) => /^https?:|^\/\//i.test(url) && new URL(url, own).origin !== own;

test("ROW-043 control: the recorder sees the page's own document request", async ({ page }) => {
  asActor('anonymous');
  const requests = record(page);
  await openChecker(page);
  const own = new URL(PRODUCT_URL).origin;
  expect(
    requests.some((r) => r.type === 'document' && new URL(r.url).origin === own),
    "ROW-043 control: the page's own document request was recorded",
  ).toBe(true);
});

test('ROW-043 the page loads nothing from another host, on load or while a check is drawn', async ({ page }) => {
  asActor('anonymous');
  const offer = misspelledOffer(freshRandom());
  const requests = record(page);
  const own = new URL(PRODUCT_URL).origin;

  await openChecker(page);
  await enterOffer(page, offer.text);
  const answered = await pressCheck(page);
  expect(answered.status, 'ROW-043: the check was answered 200').toBe(200);
  await expectMisspellingShown(page, offer, 'ROW-043: the check ran and its misspelling is highlighted at its own place');
  await page.waitForLoadState('networkidle');

  expect(
    requests.filter((r) => foreign(r.url, own)).map((r) => `${r.type} ${r.url}`),
    'ROW-043: every request the page made went to its own origin',
  ).toEqual([]);

  const refs = await page.evaluate(() => {
    const out: string[] = [];
    const add = (tag: string, v: string | null) => {
      if (v && v.trim()) out.push(`${tag} ${v.trim()}`);
    };
    document.querySelectorAll('script[src]').forEach((e) => add('script', e.getAttribute('src')));
    document.querySelectorAll('link[href]').forEach((e) => {
      if ((e.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).some((r) => r !== 'canonical' && r !== 'alternate')) add(`link[${e.getAttribute('rel')}]`, e.getAttribute('href'));
    });
    document.querySelectorAll('img[src], source[src], iframe[src], video[src], audio[src], embed[src], track[src], input[type="image"][src]').forEach((e) => add(e.tagName.toLowerCase(), e.getAttribute('src')));
    document.querySelectorAll('img[srcset], source[srcset]').forEach((e) =>
      (e.getAttribute('srcset') ?? '').split(',').forEach((part) => add(`${e.tagName.toLowerCase()}[srcset]`, part.trim().split(/\s+/)[0])),
    );
    document.querySelectorAll('video[poster]').forEach((e) => add('video[poster]', e.getAttribute('poster')));
    document.querySelectorAll('object[data]').forEach((e) => add('object', e.getAttribute('data')));
    return out;
  });
  expect(
    refs.filter((r) => foreign(r.slice(r.indexOf(' ') + 1), own)),
    'ROW-043: no script, style, font, icon or image reference in the page points at another host',
  ).toEqual([]);
});
