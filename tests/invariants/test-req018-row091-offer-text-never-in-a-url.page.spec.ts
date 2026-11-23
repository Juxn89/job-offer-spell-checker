// Purpose: ROW-091 (REQ-018) — in every browser of the harness, pressing Revisar ortografía or Enter with
// scripts disabled, or before the page's script has loaded, changes no URL and sends no request carrying the
// offer's text; and across a full check, the suggestion menu and a Replace, no request URL holds a marker or a
// flagged word.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if
// ("in any log ... or cache"), A-008, REQ-010 and REQ-011; fresh markers per run; no expected value comes from
// the product.
//
// Test argument
// ROW-091 promise: with scripts disabled and before the page script loads, pressing Check spelling or Enter
//   changes no URL and sends no request carrying the text, and across a full check, menu and Replace no request
//   URL holds the marker or a flagged word (REQ-018: a URL is written to history, access logs and caches — the
//   text must never reach one; A-008 "never stored or logged"; REQ-010 the menu; REQ-011 Replace).
// ROW-091 wrong product: a page whose box sits in a plain <form> with no method — with scripts off or not yet
//   loaded, pressing the button (or Enter) submits a GET to /?texto=<the offer>, which lands in the browser's
//   history and the server's access log; or a page that fetches suggestions with GET /api/suggest?word=<the
//   flagged word>.
// ROW-091 given: a fresh marker offer holding an unknown word and an accent misspelling; when: (A) in a context
//   with scripts disabled, the offer is entered and the button pressed, and on a fresh load entered and Enter
//   pressed in the box; (B) the same with scripts enabled while the page's own scripts are held back; (C) with
//   scripts on, the offer is checked, the misspelling's highlight opened and its accented suggestion chosen;
//   then: in A and B the URL is the one loaded and no request after the entry carries a marker in its URL or
//   body; in C no request URL (raw or percent-decoded) of the whole session holds a marker or either flagged
//   word, in any searched form.
// ROW-091 controls: in C the suggestion replaced exactly the misspelling in the box (the check, the menu and
//   Replace all ran); and the control case sees the page's own check carry the marker in its POST body, never
//   its URL, with the marker highlighted — the recorder sees bodies and the path is reached.
// ROW-091 technique: a recorder over every request of the context, on the engine door per browser of the
//   harness (RULE-014), at the two moments no script can intervene (scripts off; scripts not yet run). When the
//   box is not drawn without (or before) the page's scripts, no writer can press anything then, and A or B has
//   nothing to press (recorded as an annotation on the case); C and the URL search run in every case.
// cases: ROW-091 target=ROW-091-no-url-change-or-text-request-without-scripts-and-no-marker-in-any-url-across-check-menu-and-replace control=ROW-091-control-the-check-carries-the-marker-in-its-body-not-its-url

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import {
  asActor,
  CHECK_PATH,
  el,
  enterOffer,
  freshRandom,
  openChecker,
  pressCheck,
  PRODUCT_URL,
  readHighlights,
  ROLES,
} from './harness';
import { base64Slices, boxText, markerOffer, needleForms, percentDecoded, recordRequests, type MarkerOffer, type Needle, type SentRequest } from './privacy-text-helpers';

function contextOptions(extra: Record<string, unknown>) {
  const use = test.info().project.use as Record<string, unknown>;
  const keep = ['viewport', 'userAgent', 'deviceScaleFactor', 'isMobile', 'hasTouch', 'screen', 'locale'];
  const o: Record<string, unknown> = { baseURL: PRODUCT_URL };
  for (const k of keep) if (use[k] !== undefined) o[k] = use[k];
  return { ...o, ...extra };
}

const carrying = (reqs: SentRequest[], needles: readonly Needle[]) =>
  reqs
    .filter((r) => needles.some((n) => r.url.includes(n.value) || percentDecoded(r.url).includes(n.value) || r.postData.includes(n.value) || percentDecoded(r.postData).includes(n.value)))
    .map((r) => `${r.method} ${r.url.slice(0, 160)}`);

// Presses the button, then (on a fresh load) Enter in the box, each after entering the offer; returns, for
// each, the URL after the press and the requests sent after the entry that carry a marker.
async function pressWithoutScripts(
  page: Page,
  context: BrowserContext,
  offer: MarkerOffer,
  needles: Needle[],
  load: () => Promise<boolean>,
): Promise<{ press: string; urlBefore: string; urlAfter: string; carrying: string[] }[] | 'box not drawn before the scripts'> {
  const rec = await recordRequests(context);
  const out: { press: string; urlBefore: string; urlAfter: string; carrying: string[] }[] = [];
  for (const press of ['the check button', 'Enter in the box'] as const) {
    if (!(await load())) return 'box not drawn before the scripts';
    const urlBefore = page.url();
    await el(page, ROLES.offer).first().fill(offer.text);
    const from = rec.sent.length;
    if (press === 'the check button') await el(page, ROLES.check).first().click({ timeout: 10_000 });
    else await el(page, ROLES.offer).first().press('Enter', { timeout: 10_000 });
    await page.waitForLoadState('load', { timeout: 3_000 }).catch(() => undefined); // held scripts keep 'load' away in B
    await page.waitForTimeout(1_000); // the observation window after the press: a submit starts within it
    out.push({ press, urlBefore, urlAfter: page.url(), carrying: carrying(rec.sent.slice(from), needles) });
  }
  return out;
}

test('ROW-091-control-the-check-carries-the-marker-in-its-body-not-its-url', async ({ page, context }) => {
  asActor('anonymous');
  const offer = markerOffer(freshRandom());
  const rec = await recordRequests(context);
  await openChecker(page);
  await enterOffer(page, offer.text);
  await pressCheck(page);
  await expect
    .poll(async () => (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word), {
      message: `ROW-091 control: the check highlights the marker word ${offer.unknown.word}`,
      timeout: 15_000,
    })
    .toContain(offer.unknown.word);
  const checks = rec.sent.filter((r) => r.method === 'POST' && new URL(r.url).pathname === CHECK_PATH);
  expect(
    checks.map((r) => ({ inBody: r.postData.includes(offer.unknown.word), inUrl: r.url.includes(offer.unknown.word) })),
    'ROW-091 control: the page\'s one check carries the marker in its body, not its URL',
  ).toEqual([{ inBody: true, inUrl: false }]);
});

test('ROW-091-no-url-change-or-text-request-without-scripts-and-no-marker-in-any-url-across-check-menu-and-replace', async ({ browser, page, context }) => {
  test.setTimeout(240_000);
  asActor('anonymous');
  const rng = freshRandom();
  const offer = markerOffer(rng);
  const needles = needleForms(offer, rng);

  // (A) scripts disabled
  const noJs = await browser.newContext(contextOptions({ javaScriptEnabled: false }));
  const a = await (async () => {
    const p = await noJs.newPage();
    return pressWithoutScripts(p, noJs, offer, needles, async () => {
      await p.goto('/', { waitUntil: 'load' });
      return el(p, ROLES.offer).first().isVisible();
    });
  })();
  await noJs.close();
  if (a === 'box not drawn before the scripts') test.info().annotations.push({ type: 'ROW-091', description: 'A: with scripts disabled the box is not drawn — nothing can be pressed' });

  // (B) scripts enabled, the page's own scripts held back
  const held = await browser.newContext(contextOptions({}));
  const holding: Route[] = [];
  await held.route('**/*', (route) => {
    const r = route.request();
    if (r.resourceType() === 'script' && new URL(r.url()).host === new URL(PRODUCT_URL).host) holding.push(route);
    else route.continue();
  });
  const b = await (async () => {
    const p = await held.newPage();
    return pressWithoutScripts(p, held, offer, needles, async () => {
      await p.goto('/', { waitUntil: 'commit' });
      return el(p, ROLES.offer).first().isVisible({ timeout: 5_000 }).catch(() => false);
    });
  })();
  if (b === 'box not drawn before the scripts') test.info().annotations.push({ type: 'ROW-091', description: 'B: the box is not drawn before the page scripts run — nothing can be pressed before them' });
  for (const r of holding) await r.continue().catch(() => undefined);
  await held.close();

  // (C) a full check, the menu and Replace, scripts on
  const rec = await recordRequests(context);
  await openChecker(page);
  await enterOffer(page, offer.text);
  await pressCheck(page);
  const flag = page.locator(`[data-element="flag"]`, { hasText: new RegExp(`^${offer.misspelled.word}$`) }).first();
  await expect(flag, `ROW-091 reach: ${offer.misspelled.word} is highlighted`).toBeVisible({ timeout: 15_000 });
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await flag.tap();
  else await flag.click();
  const choice = page
    .getByRole('option', { name: offer.correction, exact: true })
    .or(page.getByRole('menuitem', { name: offer.correction, exact: true }))
    .or(page.getByRole('button', { name: offer.correction, exact: true }))
    .first();
  await expect(choice, `ROW-091 reach: the menu offers ${offer.correction} for ${offer.misspelled.word}`).toBeVisible({ timeout: 15_000 });
  if (touch) await choice.tap();
  else await choice.click();
  const replaced = offer.text.slice(0, offer.misspelled.start) + offer.correction + offer.text.slice(offer.misspelled.end);
  await expect.poll(() => boxText(page), { message: `ROW-091 reach: Replace put ${offer.correction} in place of ${offer.misspelled.word}`, timeout: 15_000 }).toBe(replaced);
  await rec.collectPageSide(page);

  const flaggedForms: Needle[] = [offer.misspelled.word, encodeURIComponent(offer.misspelled.word), ...base64Slices(offer.misspelled.word)]
    .filter((v) => v.length >= 6)
    .map((value) => ({ form: 'flagged word', value }));
  const urlNeedles = [...needles, ...flaggedForms];
  const urlsWith = rec.sent
    .filter((r) => urlNeedles.some((n) => r.url.includes(n.value) || percentDecoded(r.url).includes(n.value)))
    .map((r) => `${r.method} ${r.url.slice(0, 160)}`);

  const shape = (x: typeof a) => (typeof x === 'string' ? x : x.map((s) => ({ press: s.press, urlUnchanged: s.urlAfter === s.urlBefore, carrying: s.carrying })));
  const clean = (x: typeof a) => (typeof x === 'string' ? x : x.map((s) => ({ press: s.press, urlUnchanged: true, carrying: [] as string[] })));
  expect(
    { scriptsDisabled: shape(a), beforeScriptsLoad: shape(b), urlsHoldingMarkerOrFlaggedWord: urlsWith },
    'ROW-091: without scripts and before them, a press changes no URL and sends no text; across check, menu and Replace no request URL holds a marker or a flagged word',
  ).toEqual({ scriptsDisabled: clean(a), beforeScriptsLoad: clean(b), urlsHoldingMarkerOrFlaggedWord: [] });
});
