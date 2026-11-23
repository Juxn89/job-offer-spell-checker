// Purpose: ledger test for ROW-127 (REQ-033, REQ-018) — following the privacy-note link with an offer in
// the box and coming back leaves the offer exactly as it was, with nothing written to browser storage.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from ROW-127, REQ-033 (A-029) and REQ-018 (A-008), never from the product's source.
//
// Test argument
// ROW-127 promise: REQ-033 links the note from the footer (A-029) and REQ-018 forbids keeping the offer's
// ROW-127   text in "the browser's storage" (A-008: never stored); together, as ROW-127 states: reading the
// ROW-127   note and coming back leaves the offer exactly as it was, and nothing is written to storage.
// ROW-127 wrong product: (a) the link navigates the tab away and the box is empty on return — the offer
// ROW-127   lost; (b) the page saves the draft to sessionStorage or localStorage before leaving and restores
// ROW-127   it on return (the obvious fix for (a), and exactly what REQ-018 forbids); (c) the return restores
// ROW-127   the text but trims its trailing spaces, folds its blank lines or drops its tab.
// ROW-127 given: a fresh browser context that records every storage write any of its pages attempts
// ROW-127   (Storage.setItem, indexedDB.open, document.cookie, CacheStorage.open, cookieStore.set) from the
// ROW-127   first navigation; a fresh offer with a fresh marker, line breaks, a blank line, bullets, a tab,
// ROW-127   doubled and trailing spaces and an emoji, entered in the box.
// ROW-127 when: the writer operates the privacy link inside the footer, the note is shown, and the writer
// ROW-127   comes back — first by the note's own back control (data-element="back", D-021) or, when the
// ROW-127   note opened in another tab, by returning to the checker's tab; then, following the link again,
// ROW-127   by the browser's back button when the note took the checker's tab to another address
// ROW-127   (otherwise the checker's tab was never left, and it is read as it stands). Both paths are one
// ROW-127   case: the row is kept only when every way back keeps the offer.
// ROW-127 then: the box's text equals the offer character for character; no storage write was attempted
// ROW-127   by any page; and localStorage, sessionStorage, IndexedDB, CacheStorage and cookies are all empty,
// ROW-127   read on the note's page and again after the return.
// ROW-127 controls: the control case shows, before the link is followed, that the box holds the offer
// ROW-127   exactly and storage is empty and the recorder is installed — so the target's after-state is
// ROW-127   compared with a known before.
// ROW-127 technique: before/after on one exact place (the box's own text) with an offer whose whitespace a
// ROW-127   lossy restore would change; storage observed both at the write calls and at the end state.
// ROW-127 cases: ROW-127 target=tests/invariants/test-req033-row127-privacy-roundtrip-keeps-offer.page.spec.ts::[chromium]ROW-127_coming_back_from_the_note,_by_its_own_back_control_and_by_the_browser's_back_button,_leaves_the_offer_exactly_as_it_was,_nothing_in_storage control=tests/invariants/test-req033-row127-privacy-roundtrip-keeps-offer.page.spec.ts::[chromium]ROW-127_control:_before_the_link,_the_box_holds_the_offer_and_storage_is_empty

import { expect, test, type Page } from '@playwright/test';
import { asActor, el, enterOffer, freshMarker, openChecker, ROLES } from './harness';
import {
  EMPTY_STORAGE,
  followFooterPrivacyLink,
  operate,
  readOfferText,
  recordStorageWrites,
  storageSnapshot,
} from './privacy-page-helpers';

function freshOffer(): string {
  const m = freshMarker();
  return (
    `Buscamos persona  para el equipo ${m}  \n` +
    `\n` +
    `• Experiencia en proyectos\t(valoramos formación)\n` +
    `• Jornada completa — horario flexible 🙂 \n` +
    `Requisitos: ${m}`
  );
}

async function expectStorageEmpty(page: Page, writes: string[], where: string): Promise<void> {
  expect(writes, `ROW-127 (${where}): no page attempted to write browser storage`).toEqual([]);
  expect(await storageSnapshot(page), `ROW-127 (${where}): browser storage holds nothing`).toEqual(EMPTY_STORAGE);
}

test('ROW-127 control: before the link, the box holds the offer and storage is empty', async ({ page, context }) => {
  asActor('anonymous');
  const writes = await recordStorageWrites(context);
  const offer = freshOffer();
  await openChecker(page);
  await enterOffer(page, offer);
  expect(await readOfferText(page), 'ROW-127 control: the box holds the offer exactly as entered').toBe(offer);
  await expectStorageEmpty(page, writes, 'before the link');
});

test("ROW-127 coming back from the note, by its own back control and by the browser's back button, leaves the offer exactly as it was, nothing in storage", async ({ page, context }) => {
  asActor('anonymous');
  const writes = await recordStorageWrites(context);
  const offer = freshOffer();
  await openChecker(page);
  await enterOffer(page, offer);

  // Return path 1: the note's own back control (or, for a note in another tab, the checker's tab).
  const first = await followFooterPrivacyLink(page);
  await expectStorageEmpty(first.note, writes, 'on the note, first visit');
  if (first.how === 'new-tab') {
    await page.bringToFront();
  } else {
    const back = el(first.note, ROLES.back);
    await expect(back.first(), 'ROW-127: the note shows its back control (data-element="back")').toBeVisible({ timeout: 15_000 });
    await operate(first.note, back.first());
  }
  await expect(el(page, ROLES.offer).first(), "ROW-127: the checker's text box is shown again after the note's back control").toBeVisible({ timeout: 15_000 });
  expect(await readOfferText(page), "ROW-127: after the note's back control, the box holds the offer exactly as it was").toBe(offer);
  await expectStorageEmpty(page, writes, "after the note's back control");
  if (first.how === 'new-tab') await first.note.close();

  // Return path 2: the browser's back button, when the note took the checker's tab to another address;
  // otherwise the checker's tab was never left, and it is read as it stands.
  const second = await followFooterPrivacyLink(page);
  await expectStorageEmpty(second.note, writes, 'on the note, second visit');
  if (second.how === 'same-tab-navigated') await page.goBack({ waitUntil: 'load' });
  else if (second.how === 'new-tab') await page.bringToFront();
  await expect(el(page, ROLES.offer).first(), "ROW-127: the checker's text box is shown again after the browser's back button").toBeVisible({ timeout: 15_000 });
  expect(await readOfferText(page), "ROW-127: after the browser's back button, the box holds the offer exactly as it was").toBe(offer);
  await expectStorageEmpty(page, writes, "after the browser's back button");
});
