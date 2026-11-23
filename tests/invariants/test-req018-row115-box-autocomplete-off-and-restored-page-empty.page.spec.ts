// Purpose: ROW-115 (REQ-018) — in every browser of the harness, the text box declares autocomplete="off", and
// after a marker check the page restored from its history entry (the restore a reopened tab gets) shows an
// empty box and no marker anywhere on the page.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if
// ("in the browser's ... storage"), A-008 and D-003; fresh markers per run; no expected value comes from the
// product.
//
// Test argument
// ROW-115 promise: the box declares autocomplete off, and a tab closed after a marker check and reopened through
//   the browser's restore shows an empty box (REQ-018 "never written to ... the browser's storage"; A-008
//   "never stored"; D-003 the text lives only in the request's memory).
// ROW-115 wrong product: a page whose textarea carries no autocomplete="off": the browser saves the box's
//   contents in the history entry's form state (and in its session file on disk), and a restored tab — or the
//   next person on a shared computer reopening it — finds the offer back in the box.
// ROW-115 given: a fresh marker offer, checked through the page; when: the page is left for the privacy note
//   and its history entry restored (Back) — the same entry state a reopened tab is rebuilt from — with the
//   back-forward cache ruled out (an unload listener added by the test, and a restore that reports
//   `persisted` failing as setup), so the page is rebuilt, not resumed; then: the box declares
//   autocomplete="off", the restored box is empty, and no form of the markers is in the page's text or any
//   field's value.
// ROW-115 controls: the check highlighted the marker word (the text was really in the box and checked) and the
//   page restored is the checker, rebuilt from its history entry (navigation type back_forward, not persisted).
// ROW-115 technique: the browser's own form-state restoration exercised through history on the engine door,
//   per browser of the harness (RULE-014) — the closed-tab menu itself is browser chrome no engine door
//   operates; the attribute read on the box as the declaration the row names.
// cases: ROW-115 target=ROW-115-box-declares-autocomplete-off-and-the-restored-page-shows-an-empty-box control=ROW-115-control-the-marker-check-ran-and-the-page-is-rebuilt-from-history

import { expect, test, type Page } from '@playwright/test';
import { asActor, el, enterOffer, freshRandom, openChecker, pressCheck, readHighlights, ROLES } from './harness';
import { boxText, foundIn, markerOffer, needleForms, type MarkerOffer } from './privacy-text-helpers';

async function checkThenRestore(page: Page, offer: MarkerOffer, row: string): Promise<{ navType: string; persisted: boolean | null }> {
  await page.addInitScript(() => {
    window.addEventListener('pageshow', (e) => {
      (window as unknown as { __vidPersisted?: boolean }).__vidPersisted = (e as PageTransitionEvent).persisted;
    });
  });
  await openChecker(page);
  await enterOffer(page, offer.text);
  await pressCheck(page);
  await expect
    .poll(async () => (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word), {
      message: `${row} reach: the check highlights the marker word ${offer.unknown.word}`,
      timeout: 15_000,
    })
    .toContain(offer.unknown.word);
  await page.evaluate(() => window.addEventListener('unload', () => undefined)); // no back-forward cache for this page
  await page.goto('/privacidad', { waitUntil: 'load' });
  await page.goBack({ waitUntil: 'load' });
  await expect(el(page, ROLES.offer).first(), `${row}: the restored page is the checker`).toBeVisible({ timeout: 15_000 });
  return page.evaluate(() => ({
    navType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'unknown',
    persisted: (window as unknown as { __vidPersisted?: boolean }).__vidPersisted ?? null,
  }));
}

test('ROW-115-control-the-marker-check-ran-and-the-page-is-rebuilt-from-history', async ({ page }) => {
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  const restored = await checkThenRestore(page, offer, 'ROW-115 control');
  expect(restored, 'ROW-115 control: the checker page was rebuilt from its history entry, not resumed from the back-forward cache').toEqual({ navType: 'back_forward', persisted: false });
});

test('ROW-115-box-declares-autocomplete-off-and-the-restored-page-shows-an-empty-box', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const offer = markerOffer(rng);
  const needles = needleForms(offer, rng);
  const restored = await checkThenRestore(page, offer, 'ROW-115');
  if (restored.persisted !== false) throw new Error(`setup: ROW-115 — the page came back from the back-forward cache (${JSON.stringify(restored)}), which a reopened tab never does`);
  const box = el(page, ROLES.offer).first();
  const onPage = await page.evaluate(() => {
    const values = Array.from(document.querySelectorAll('input, textarea')).map((f) => (f as HTMLInputElement).value);
    return document.body.innerText + '\n' + values.join('\n');
  });
  expect(
    { autocomplete: await box.getAttribute('autocomplete'), restoredBox: (await boxText(page)).trim(), markerFormsOnPage: foundIn(onPage, needles) },
    'ROW-115: the box declares autocomplete="off", and the page restored after a marker check shows an empty box and no marker',
  ).toEqual({ autocomplete: 'off', restoredBox: '', markerFormsOnPage: [] });
});
