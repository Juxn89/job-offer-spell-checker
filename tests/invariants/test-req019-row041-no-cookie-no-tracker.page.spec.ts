// Purpose: ledger test for ROW-041 (REQ-019) — loading the checker page and running a check sets no
// cookie and loads no analytics or tracking script.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from REQ-019 and owner answers A-009 and A-025, never from the product's source.
//
// Test argument
// ROW-041 promise: REQ-019 (A-025: "no cookies; no tracker of any kind"; A-009: "no analytics or
// ROW-041   counting") — the page sets no cookie and loads no analytics or tracking script.
// ROW-041 wrong product: the server answers the page or the check with a Set-Cookie (a session or
// ROW-041   load-balancer cookie); the page script writes document.cookie (a "seen the notice" flag); the
// ROW-041   page loads a self-hosted analytics script (/assets/plausible.js) or calls navigator.sendBeacon
// ROW-041   after a check to count usage.
// ROW-041 given: a fresh browser context (no cookies), every request and response of the page recorded
// ROW-041   from the first navigation; a fresh offer with one known misspelling (the dictionary oracle).
// ROW-041 when: the page is loaded, the offer entered and the check button pressed, and the check has
// ROW-041   been drawn (the misspelling is highlighted at its own place: the check really ran).
// ROW-041 then: no response carried Set-Cookie; the context holds no cookie and document.cookie is
// ROW-041   empty; no request was a beacon or ping; no request went to another origin; no request URL names
// ROW-041   an analytics or tracking product; no analytics global exists on the page.
// ROW-041 controls: the control case shows the recorder sees the page's own document request, so an
// ROW-041   empty record cannot pass for "nothing loaded"; inside the target, the drawn misspelling shows
// ROW-041   the check path was reached before the absence is read.
// ROW-041 technique: a recorder over the whole session (load + check) rather than a sample — "no cookie,
// ROW-041   no tracker" is a "never" promise, so every request and response is the population; the drawn
// ROW-041   check is the before/after that keeps the absence meaningful.
// ROW-041 cases: ROW-041 target=tests/invariants/test-req019-row041-no-cookie-no-tracker.page.spec.ts::[chromium]ROW-041_loading_the_page_and_running_a_check_sets_no_cookie_and_loads_no_tracker control=tests/invariants/test-req019-row041-no-cookie-no-tracker.page.spec.ts::[chromium]ROW-041_control:_the_recorder_sees_the_page's_own_requests

import { expect, test, type Page } from '@playwright/test';
import { asActor, enterOffer, freshRandom, openChecker, pressCheck, PRODUCT_URL } from './harness';
import { expectMisspellingShown, misspelledOffer } from './privacy-page-helpers';

const TRACKER_URL =
  /analytics|tagmanager|gtag|matomo|piwik|plausible|segment\.(io|com)|mixpanel|hotjar|clarity\.ms|fbevents|facebook|doubleclick|umami|posthog|amplitude|heap(analytics)?|tracking|tracker|\bpixel\b|telemetry|beacon|\/collect\b|stats\.js/i;
const TRACKER_GLOBALS = ['ga', 'gtag', 'dataLayer', '_gaq', '_paq', 'fbq', 'plausible', 'mixpanel', 'amplitude', 'posthog', 'hj', '_hsq', 'clarity', 'umami', 'heap', 'Matomo', 'Piwik', '_satellite', 'ym', 'analytics'];

type Seen = { url: string; type: string; method: string };

function record(page: Page) {
  const requests: Seen[] = [];
  const setCookies: string[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), type: r.resourceType(), method: r.method() }));
  page.on('response', async (r) => {
    try {
      for (const h of await r.headersArray()) if (h.name.toLowerCase() === 'set-cookie') setCookies.push(`${r.url()} → ${h.value}`);
    } catch {
      /* the response went away with its page */
    }
  });
  return { requests, setCookies };
}

test("ROW-041 control: the recorder sees the page's own requests", async ({ page }) => {
  asActor('anonymous');
  const seen = record(page);
  await openChecker(page);
  const own = new URL(PRODUCT_URL).origin;
  expect(
    seen.requests.some((r) => r.type === 'document' && new URL(r.url).origin === own),
    "ROW-041 control: the page's own document request was recorded",
  ).toBe(true);
});

test('ROW-041 loading the page and running a check sets no cookie and loads no tracker', async ({ page }) => {
  asActor('anonymous');
  const offer = misspelledOffer(freshRandom());
  const seen = record(page);

  await openChecker(page);
  await enterOffer(page, offer.text);
  const answered = await pressCheck(page);
  expect(answered.status, 'ROW-041: the page\'s check was answered 200').toBe(200);
  await expectMisspellingShown(page, offer, 'ROW-041: the check ran and its misspelling is highlighted at its own place');
  await page.waitForLoadState('networkidle');

  const own = new URL(PRODUCT_URL).origin;
  expect(seen.setCookies, 'ROW-041: no response of the page or the check sets a cookie').toEqual([]);
  expect(await page.context().cookies(), 'ROW-041: the browser holds no cookie after loading and checking').toEqual([]);
  expect(await page.evaluate(() => document.cookie), 'ROW-041: document.cookie is empty').toBe('');
  expect(
    seen.requests.filter((r) => r.type === 'ping' || r.type === 'beacon'),
    'ROW-041: the page sends no beacon or ping',
  ).toEqual([]);
  expect(
    seen.requests.filter((r) => /^https?:/.test(r.url) && new URL(r.url).origin !== own).map((r) => r.url),
    'ROW-041: the page sends no request to another origin',
  ).toEqual([]);
  expect(
    seen.requests.filter((r) => /^https?:/.test(r.url) && TRACKER_URL.test(new URL(r.url).pathname + new URL(r.url).search)).map((r) => r.url),
    'ROW-041: no request names an analytics or tracking product',
  ).toEqual([]);
  const globals = await page.evaluate((names) => names.filter((n) => (window as unknown as Record<string, unknown>)[n] !== undefined), TRACKER_GLOBALS);
  expect(globals, 'ROW-041: no analytics or tracking global exists on the page').toEqual([]);
});
