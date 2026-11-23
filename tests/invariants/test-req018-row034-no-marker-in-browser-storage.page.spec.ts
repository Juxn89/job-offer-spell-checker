// Purpose: ROW-034 (REQ-018) — in every browser of the harness, after a marker offer's normal check, a failed
// check, a refused check and a reload, no form of the markers is in the page origin's local storage, session
// storage, IndexedDB or cookies.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if,
// A-008, REQ-021, REQ-025 and D-003; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-034 promise: after checks of an offer carrying a unique marker, including a refused and a failed check and
//   a reload, the marker is absent from local storage, session storage, IndexedDB and cookies (REQ-018 fail-if
//   "in the browser's local storage, session storage, IndexedDB or cookies"; A-008; D-003 no browser storage).
// ROW-034 wrong product: a page that saves the draft to sessionStorage "so a failed or refused check never
//   loses the writer's text" and restores it after a reload — the offer then sits in the browser, readable by
//   the next person on a shared computer; or one that keeps the last result in IndexedDB.
// ROW-034 given: a fresh marker offer; when: it is checked (answered normally), checked again while the check
//   endpoint fails (the harness answers the page's request with a 503, the way a down checker does), checked
//   at 10,001 characters (refused, REQ-021), and the page reloaded; then: before and after the reload, none of
//   the markers' forms (plain, case, escaped, percent-encoded, base64) is in any of the four stores.
// ROW-034 controls: the normal check highlighted the marker word, the failed and the refused check each showed
//   a new message (both paths reached); a fresh control value planted in each of the four stores is read back
//   by the same reader (the reader sees each store, IndexedDB listed).
// ROW-034 technique: planted fresh markers searched in every encoding across the four stores, through the page
//   and the context (HttpOnly cookies included), per browser of the harness (RULE-014).
// cases: ROW-034 target=ROW-034-marker-absent-from-browser-storage-after-checks-a-failure-a-refusal-and-a-reload control=ROW-034-control-each-path-reached-and-the-reader-sees-all-four-stores

import { expect, test, type Page } from '@playwright/test';
import { asActor, CHECK_PATH, enterOffer, freshMarker, freshRandom, openChecker, pressCheck, PRODUCT_URL, readHighlights } from './harness';
import {
  expectNewMessage,
  foundIn,
  markerOffer,
  messageText,
  needleForms,
  oversizeMarkerText,
  plantStoreControls,
  pressCheckNoWait,
  readBrowserStores,
  type BrowserStores,
  type Needle,
} from './privacy-text-helpers';

const inStores = (s: BrowserStores, needles: readonly Needle[]) => ({
  localStorage: foundIn(s.localStorage, needles),
  sessionStorage: foundIn(s.sessionStorage, needles),
  indexedDB: foundIn(s.indexedDB, needles),
  cookies: foundIn(s.cookies, needles),
});
const none = { localStorage: [], sessionStorage: [], indexedDB: [], cookies: [] };

// The row's checks: normal, failed, refused. Returns once each has shown its effect.
async function runChecks(page: Page, row: string): Promise<{ needles: Needle[] }> {
  const rng = freshRandom();
  const offer = markerOffer(rng);
  const needles = needleForms(offer, rng);
  await openChecker(page);
  await enterOffer(page, offer.text);
  await pressCheck(page);
  await expect
    .poll(async () => (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word), {
      message: `${row} reach: the normal check highlights the marker word ${offer.unknown.word}`,
      timeout: 15_000,
    })
    .toContain(offer.unknown.word);
  // a failed check: the check endpoint answers 503, as when the checker cannot run
  await page.route(`**${CHECK_PATH}`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
  let before = await messageText(page);
  await pressCheck(page);
  await expectNewMessage(page, before, `${row} reach: a failed check shows its message`);
  await page.unroute(`**${CHECK_PATH}`);
  // a refused check: 10,001 characters (REQ-021); the page may refuse it before sending
  before = await messageText(page);
  await enterOffer(page, oversizeMarkerText(offer, rng));
  await pressCheckNoWait(page);
  await expectNewMessage(page, before, `${row} reach: a 10,001-character check is refused with a message`);
  return { needles };
}

test('ROW-034-control-each-path-reached-and-the-reader-sees-all-four-stores', async ({ page }) => {
  test.setTimeout(180_000);
  asActor('anonymous');
  await runChecks(page, 'ROW-034 control');
  await page.reload({ waitUntil: 'load' });
  const control = freshMarker();
  await plantStoreControls(page, PRODUCT_URL, control);
  const stores = await readBrowserStores(page);
  expect(
    { indexedDBListed: stores.indexedDBListed, ...inStores(stores, [{ form: 'control', value: control }]) },
    'ROW-034 control: a value planted in each store is read back by the reader',
  ).toEqual({ indexedDBListed: true, localStorage: ['control'], sessionStorage: ['control'], indexedDB: ['control'], cookies: ['control'] });
});

test('ROW-034-marker-absent-from-browser-storage-after-checks-a-failure-a-refusal-and-a-reload', async ({ page }) => {
  test.setTimeout(180_000);
  asActor('anonymous');
  const { needles } = await runChecks(page, 'ROW-034');
  const beforeReload = await readBrowserStores(page);
  await page.reload({ waitUntil: 'load' });
  const afterReload = await readBrowserStores(page);
  expect(afterReload.indexedDBListed, 'ROW-034 setup: the engine lists its IndexedDB databases').toBe(true);
  expect(
    { beforeReload: inStores(beforeReload, needles), afterReload: inStores(afterReload, needles) },
    'ROW-034: after a normal, a failed and a refused check of the marker offer, and after a reload, no store holds a form of the markers',
  ).toEqual({ beforeReload: none, afterReload: none });
});
