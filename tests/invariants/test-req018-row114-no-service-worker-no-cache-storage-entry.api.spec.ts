// Purpose: ROW-114 (REQ-018) — after marker checks, a refused check and a reload, the product's origin has no
// service worker registered and its Cache Storage holds no entry carrying any form of the markers — in
// Chromium and Firefox, each launched so the harness's plain-http origin counts as secure (as HTTPS does in
// production), since neither API exists on an insecure origin.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if
// ("in any cache"), A-008 and D-003; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-114 promise: after marker checks, a refused check and a reload, no service worker is registered for the
//   site and Cache Storage holds no entry carrying the marker (REQ-018 "never written to ... a cache, or the
//   browser's storage"; A-008; D-003).
// ROW-114 wrong product: an "offline-ready" page that registers a service worker which caches every response
//   — the check's answer, or the page with the last text — in Cache Storage, so the offer outlives the tab.
// ROW-114 given: a fresh marker offer, in a browser that treats the product's origin as a secure context;
//   when: it is checked (answered normally), checked again, checked at 10,001 characters (refused) and the
//   page reloaded; then: before and after the reload, the origin's service-worker registrations are none and
//   no Cache Storage entry (its URL, headers or body) holds a form of the markers.
// ROW-114 controls: the normal checks highlighted the marker word, the refusal showed a new message; the
//   origin is a secure context with both APIs present; a control entry put in a fresh cache is read back by
//   the same reader.
// ROW-114 technique: the APIs read from inside the origin after a real session, per engine. Honest limit:
//   WebKit offers no switch to make a plain-http origin secure, so on the harness (no TLS proxy yet, D-025)
//   neither API exists there to be read; WebKit's half is owed with the proxy.
// cases: ROW-114 target=ROW-114-no-service-worker-and-no-cache-storage-entry-with-the-marker-in-chromium control=ROW-114-control-the-paths-are-reached-and-the-reader-sees-cache-storage-in-chromium

import { expect, test, type Browser, type BrowserType, type Page } from '@playwright/test';
import { asActor, enterOffer, freshMarker, freshRandom, openChecker, pressCheck, PRODUCT_URL, readHighlights } from './harness';
import { expectNewMessage, foundIn, markerOffer, messageText, needleForms, oversizeMarkerText, pressCheckNoWait, type Needle } from './privacy-text-helpers';

type Engine = 'chromium' | 'firefox';

async function launch(playwright: { chromium: BrowserType; firefox: BrowserType }, engine: Engine): Promise<Browser> {
  const origin = new URL(PRODUCT_URL).origin;
  if (engine === 'chromium') return playwright.chromium.launch({ args: [`--unsafely-treat-insecure-origin-as-secure=${origin}`] });
  return playwright.firefox.launch({
    firefoxUserPrefs: {
      'dom.securecontext.allowlist': new URL(PRODUCT_URL).hostname,
      'dom.serviceWorkers.enabled': true,
      'dom.serviceWorkers.testing.enabled': true,
      'dom.caches.testing.enabled': true,
    },
  });
}

type Seen = { secure: boolean; hasServiceWorker: boolean; hasCaches: boolean; registrations: string[]; entries: string };

async function readWorkersAndCaches(page: Page): Promise<Seen> {
  return page.evaluate(async () => {
    const hasServiceWorker = 'serviceWorker' in navigator && !!navigator.serviceWorker;
    const hasCaches = typeof caches !== 'undefined';
    const registrations = hasServiceWorker ? (await navigator.serviceWorker.getRegistrations()).map((r) => `${r.scope} ${r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? ''}`) : [];
    const entries: unknown[] = [];
    if (hasCaches) {
      for (const name of await caches.keys()) {
        const c = await caches.open(name);
        for (const req of await c.keys()) {
          const res = await c.match(req);
          entries.push({ cache: name, url: req.url, method: req.method, headers: res ? [...res.headers] : [], body: res ? await res.clone().text() : '' });
        }
      }
    }
    return { secure: isSecureContext, hasServiceWorker, hasCaches, registrations, entries: JSON.stringify(entries) };
  });
}

async function runChecks(page: Page, row: string): Promise<Needle[]> {
  const rng = freshRandom();
  const offer = markerOffer(rng);
  const needles = needleForms(offer, rng);
  await openChecker(page);
  for (let i = 0; i < 2; i++) {
    await enterOffer(page, offer.text);
    await pressCheck(page);
    await expect
      .poll(async () => (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word), {
        message: `${row} reach: check ${i + 1} highlights the marker word ${offer.unknown.word}`,
        timeout: 15_000,
      })
      .toContain(offer.unknown.word);
  }
  const before = await messageText(page);
  await enterOffer(page, oversizeMarkerText(offer, rng));
  await pressCheckNoWait(page);
  await expectNewMessage(page, before, `${row} reach: a 10,001-character check is refused with a message`);
  return needles;
}

for (const engine of ['chromium', 'firefox'] as const) {
  test(`ROW-114-control-the-paths-are-reached-and-the-reader-sees-cache-storage-in-${engine}`, async ({ playwright }) => {
    test.setTimeout(180_000);
    asActor('anonymous');
    const browser = await launch(playwright, engine);
    try {
      const page = await (await browser.newContext({ baseURL: PRODUCT_URL, locale: 'es-ES' })).newPage();
      await runChecks(page, `ROW-114 control (${engine})`);
      await page.reload({ waitUntil: 'load' });
      const control = freshMarker();
      await page.evaluate(async (v) => {
        const c = await caches.open('vid-control-' + v);
        await c.put(new Request('/vid-control-' + v), new Response(v));
      }, control);
      const seen = await readWorkersAndCaches(page);
      expect(
        { secure: seen.secure, hasServiceWorker: seen.hasServiceWorker, hasCaches: seen.hasCaches, controlRead: foundIn(seen.entries, [{ form: 'control', value: control }]) },
        `ROW-114 control (${engine}): the origin is a secure context with service workers and Cache Storage, and a control entry is read back`,
      ).toEqual({ secure: true, hasServiceWorker: true, hasCaches: true, controlRead: ['control'] });
    } finally {
      await browser.close();
    }
  });

  test(`ROW-114-no-service-worker-and-no-cache-storage-entry-with-the-marker-in-${engine}`, async ({ playwright }) => {
    test.setTimeout(180_000);
    asActor('anonymous');
    const browser = await launch(playwright, engine);
    try {
      const page = await (await browser.newContext({ baseURL: PRODUCT_URL, locale: 'es-ES' })).newPage();
      const needles = await runChecks(page, `ROW-114 (${engine})`);
      const before = await readWorkersAndCaches(page);
      await page.reload({ waitUntil: 'load' });
      const after = await readWorkersAndCaches(page);
      expect({ secure: after.secure, hasServiceWorker: after.hasServiceWorker, hasCaches: after.hasCaches }, `ROW-114 setup (${engine}): both APIs exist on the origin`).toEqual({ secure: true, hasServiceWorker: true, hasCaches: true });
      expect(
        {
          beforeReload: { registrations: before.registrations, cacheEntriesWithMarker: foundIn(before.entries, needles) },
          afterReload: { registrations: after.registrations, cacheEntriesWithMarker: foundIn(after.entries, needles) },
        },
        `ROW-114 (${engine}): no service worker is registered and no Cache Storage entry holds a form of the markers`,
      ).toEqual({ beforeReload: { registrations: [], cacheEntriesWithMarker: [] }, afterReload: { registrations: [], cacheEntriesWithMarker: [] } });
    } finally {
      await browser.close();
    }
  });
}
