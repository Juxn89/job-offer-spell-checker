// Purpose: ledger test for ROW-042 (REQ-020) — an offer containing markup and a script tag is shown back
// as plain text: no markup renders and no script runs, in the highlights, the suggestions or the messages.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from REQ-020 and owner answer A-024, never from the product's source.
//
// Test argument
// ROW-042 promise: REQ-020 (A-024) — "the offer's text always shown back as plain text, never run as
// ROW-042   markup or script"; D-028 says where a highlight stands (an element data-element="flag" inside
// ROW-042   the element whose text is the offer's text).
// ROW-042 wrong product: the page draws the highlights by building HTML from the offer's text and the
// ROW-042   flags (overlay.innerHTML = text with <mark> around each flag): the <b> renders bold, the <img>
// ROW-042   fires its onerror, an "&lt;i&gt;" shows as "<i>"; or the suggestion list or the count line is
// ROW-042   written with innerHTML/insertAdjacentHTML, or the word is put unescaped into an attribute.
// ROW-042 given: a fresh offer of correct filler words carrying one known misspelling (the dictionary
// ROW-042   oracle) inside a <b> tag, plus an <img onerror>, a <script>, an <svg onload>, an attribute
// ROW-042   break-out ("><img …>), and the entities &lt;i&gt; and &amp; — every tag marked with a fresh
// ROW-042   data-vidx value and every script body setting a global named by a fresh marker.
// ROW-042 when: the offer is entered, the check button pressed, then the misspelling's highlight operated
// ROW-042   to open its suggestions.
// ROW-042 then: after the check, the misspelling is highlighted at its own offset inside an element whose
// ROW-042   text IS the offer, character for character (markup rendered or entities decoded would change it);
// ROW-042   at every stage — before the check, after it (highlights and count message drawn), with the
// ROW-042   suggestions open — no element carrying data-vidx exists, the marker global is unset, no dialog
// ROW-042   opened, and no request named the marker (an <img> that rendered would have fetched it).
// ROW-042 controls: the control case shows the box holds the hostile offer exactly as entered and nothing
// ROW-042   ran on entry, so the target's absences are read after the path was reached; inside the target,
// ROW-042   the highlight drawn and the correct word appearing once the highlight is operated show the
// ROW-042   check and the suggestion list were reached.
// ROW-042 technique: fresh markers in every tag and script, so no product can special-case them; one exact
// ROW-042   place for the text (the highlight's containing element) plus a whole-document scan for any
// ROW-042   injected element, taken before and after each action.
// ROW-042 cases: ROW-042 target=tests/invariants/test-req020-row042-offer-markup-shown-as-text.page.spec.ts::[chromium]ROW-042_markup_and_script_in_the_offer_are_shown_as_plain_text_in_highlights,_suggestions_and_messages control=tests/invariants/test-req020-row042-offer-markup-shown-as-text.page.spec.ts::[chromium]ROW-042_control:_the_box_holds_the_hostile_offer_exactly_and_nothing_ran_on_entry

import { expect, test, type Page } from '@playwright/test';
import { accentPopulation, asActor, el, enterOffer, fillerWords, freshMarker, freshRandom, openChecker, pressCheck, ROLES } from './harness';
import { expectMisspellingShown, operate, readOfferText, type MisspelledOffer } from './privacy-page-helpers';

type Hostile = MisspelledOffer & { marker: string };

function hostileOffer(): Hostile {
  const rng = freshRandom();
  const m = freshMarker();
  const pair = rng.pick(accentPopulation());
  const f = fillerWords();
  const w = () => rng.pick(f);
  const pre = `${w()} ${w()} <b data-vidx="${m}"> `;
  const text =
    pre +
    `${pair.stripped} </b> ${w()} <img src="/${m}-a.png" onerror="window['${m}']=1" data-vidx="${m}"> ${w()}\n` +
    `<script data-vidx="${m}">window['${m}']=2</script> ${w()} <svg data-vidx="${m}" onload="window['${m}']=3"></svg>\n` +
    `"><img src="/${m}-b.png" onerror="window['${m}']=4" data-vidx="${m}"> ' onfocus='window["${m}"]=5' ${w()}\n` +
    `&lt;i&gt; ${w()} &amp; ${w()}`;
  return { text, misspelled: pair.stripped, correct: pair.word, start: pre.length, marker: m };
}

function watch(page: Page, marker: string) {
  const fetched: string[] = [];
  const dialogs: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes(marker)) fetched.push(r.url());
  });
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  return { fetched, dialogs };
}

async function expectNothingInjected(page: Page, o: Hostile, seen: ReturnType<typeof watch>, stage: string) {
  const state = await page.evaluate((m) => {
    const injected = Array.from(document.querySelectorAll('[data-vidx]')).map((e) => e.tagName.toLowerCase());
    // A frame drawn from the offer would hold its own document: look inside same-origin frames too.
    for (const f of Array.from(document.querySelectorAll('iframe'))) {
      try {
        injected.push(...Array.from(f.contentDocument?.querySelectorAll('[data-vidx]') ?? []).map((e) => `iframe>${e.tagName.toLowerCase()}`));
      } catch {
        /* a cross-origin frame: not drawn from the offer */
      }
    }
    return { injected, ran: (window as unknown as Record<string, unknown>)[m] ?? null };
  }, o.marker);
  expect(state.injected, `ROW-042 (${stage}): no element was made from the offer's markup`).toEqual([]);
  expect(state.ran, `ROW-042 (${stage}): no script from the offer ran`).toBeNull();
  expect(seen.dialogs, `ROW-042 (${stage}): no dialog opened`).toEqual([]);
  expect(seen.fetched, `ROW-042 (${stage}): nothing named by the offer's markup was fetched`).toEqual([]);
}

test('ROW-042 control: the box holds the hostile offer exactly and nothing ran on entry', async ({ page }) => {
  asActor('anonymous');
  const o = hostileOffer();
  const seen = watch(page, o.marker);
  await openChecker(page);
  await enterOffer(page, o.text);
  expect(await readOfferText(page), 'ROW-042 control: the box holds the offer exactly as entered').toBe(o.text);
  await expectNothingInjected(page, o, seen, 'entered, before the check');
});

test('ROW-042 markup and script in the offer are shown as plain text in highlights, suggestions and messages', async ({ page }) => {
  asActor('anonymous');
  const o = hostileOffer();
  const seen = watch(page, o.marker);
  await openChecker(page);
  await enterOffer(page, o.text);
  await expectNothingInjected(page, o, seen, 'entered, before the check');

  const answered = await pressCheck(page);
  expect(answered.status, 'ROW-042: the check was answered 200').toBe(200);
  // The highlight stands at its own offset inside an element whose text is the offer exactly: had any
  // tag rendered or any entity been decoded, no element's text would equal the offer.
  await expectMisspellingShown(page, o, 'ROW-042: the misspelling is highlighted at its own place in a plain-text copy of the offer');
  await expectNothingInjected(page, o, seen, 'after the check: highlights and messages drawn');

  // The suggestions: operate the misspelling's highlight; its correction (the dictionary word it was
  // made from) appears in the list.
  const correction = page.getByText(o.correct, { exact: true });
  await expect(correction, 'ROW-042: the correction is not on the page before the suggestions open').toHaveCount(0);
  const flag = el(page, ROLES.flag).filter({ hasText: new RegExp(`^${o.misspelled}$`) }).first();
  await operate(page, flag);
  await expect(correction.first(), 'ROW-042: operating the highlight opens its suggestions, the correction among them').toBeVisible({ timeout: 15_000 });
  await expectNothingInjected(page, o, seen, 'suggestions open');
  expect(await readOfferText(page), 'ROW-042: the box still holds the offer exactly').toBe(o.text);
});
