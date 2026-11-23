// Purpose: ROW-090 (REQ-018) — every answer to a check request, accepted or refused, carries
// Cache-Control: no-store; and after a marker check in a real browser (Chromium, Firefox, WebKit), navigating
// away and reopening the page, no form of the markers is in that browser's HTTP cache on disk.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if
// ("in any cache"), A-008 and D-003; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-090 promise: every check response carries Cache-Control: no-store, and after a marker check, navigating
//   away and reopening, the marker is absent from the browser's HTTP cache (REQ-018 "never written to ... a
//   cache"; A-008 "never stored"; D-003 no browser storage).
// ROW-090 wrong product: a server that sets no-store in the check handler but answers refusals (the
//   10,001-character limit, the per-address limit, a malformed body) from an earlier hook without it — so a
//   shared proxy or the browser may keep a refused offer's echo; or a page that sends the check as a GET with
//   the text in the query string, which the browser's HTTP cache stores.
// ROW-090 given: a fresh marker offer; when: it is sent to the check endpoint as a normal check, at 10,001
//   characters, as a body cut short, as a body with no text, with a text/plain content type, and until the
//   per-address limit refuses it; and, in each engine, checked through the page, the page left for the
//   privacy note and reopened, the browser closed; then: every answer's Cache-Control holds the no-store
//   directive, and no file of the browser profile's HTTP cache folders (gzip bodies decompressed) holds
//   any form of the markers.
// ROW-090 controls: the normal check is answered 200 with exactly the offer's two misspellings, the oversize
//   and over-limit sends are refused with a 4xx (the refusal paths were reached), and in each engine the
//   page highlighted the marker word (the check really ran there) and the profile holds cache files (the
//   search reads the engine's HTTP cache on disk).
// ROW-090 technique: the header read on every kind of answer (the refusal paths are where it goes missing),
//   and the cache searched on disk after a real browser session, per engine, from outside the page. Honest
//   limit: an engine that keeps its HTTP cache outside its profile directory is not searched there.
// cases: ROW-090 target=ROW-090-every-check-response-carries-cache-control-no-store control=ROW-090-control-the-check-is-answered-and-each-refusal-path-reached

import { mkdtempSync, rmSync } from 'node:fs';
import { expect, test, type BrowserType } from '@playwright/test';
import {
  asActor,
  byPosition,
  enterOffer,
  freshRandom,
  holdCheckBudget,
  openChecker,
  placeOf,
  pressCheck,
  PRODUCT_URL,
  readHighlights,
  sendRaw,
  type CheckAnswer,
  type RawResponse,
} from './harness';
import { markerOffer, needleForms, oversizeMarkerText, searchLocalDirectory, type MarkerOffer } from './privacy-text-helpers';

type Answer = { what: string; status: number; cacheControl: string; flagged?: unknown };
type Scenario = { offer: MarkerOffer; answers: Answer[] };
let scenario: Promise<Scenario> | undefined;

const noStore = (cc: string) => cc.split(',').some((d) => d.trim().toLowerCase() === 'no-store');

function runScenario(): Promise<Scenario> {
  scenario ??= (async () => {
    const rng = freshRandom();
    const offer = markerOffer(rng);
    const answers: Answer[] = [];
    const note = (what: string, r: RawResponse, flagged?: unknown) => answers.push({ what, status: r.status, cacheControl: r.headers['cache-control'] ?? '(none)', flagged });
    const hold = await holdCheckBudget();
    try {
      const n = await sendRaw({ body: { text: offer.text }, pace: false });
      let flagged: unknown;
      try {
        flagged = byPosition((JSON.parse(n.body) as CheckAnswer).flagged.map(placeOf));
      } catch {
        flagged = `unparsable: ${n.body.slice(0, 200)}`;
      }
      note('normal check', n, flagged);
      note('10,001-character check', await sendRaw({ body: { text: oversizeMarkerText(offer, rng) }, pace: false }));
      const cut = JSON.stringify({ text: offer.text });
      note('body cut short', await sendRaw({ body: cut.slice(0, cut.length - 2), headers: { 'content-type': 'application/json' }, pace: false }));
      note('body with no text', await sendRaw({ body: { offer: offer.text }, pace: false }));
      note('text/plain body', await sendRaw({ body: offer.text, headers: { 'content-type': 'text/plain' }, pace: false }));
      let accepted = answers.filter((a) => a.status === 200).length;
      for (let i = 0; i < 32 && accepted <= 30; i++) {
        const r = await sendRaw({ body: { text: offer.text }, pace: false });
        if (r.status === 200) {
          accepted++;
          if (i === 0) note('a check under the limit', r);
        } else {
          note('a check over the per-address limit', r);
          break;
        }
      }
    } finally {
      await hold.release();
    }
    return { offer, answers };
  })();
  return scenario;
}

function expectReached(s: Scenario, row: string): void {
  const find = (what: string) => s.answers.find((a) => a.what === what);
  const refused = (a?: Answer) => !!a && a.status >= 400 && a.status < 500;
  expect(
    {
      normal: { status: find('normal check')?.status, flagged: find('normal check')?.flagged },
      oversizeRefused: refused(find('10,001-character check')),
      overLimitRefused: refused(find('a check over the per-address limit')),
    },
    `${row} reach: the normal check flags the offer's two misspellings; the oversize and over-limit sends are refused (${JSON.stringify(s.answers.map((a) => [a.what, a.status]))})`,
  ).toEqual({ normal: { status: 200, flagged: s.offer.flagged }, oversizeRefused: true, overLimitRefused: true });
}

test('ROW-090-control-the-check-is-answered-and-each-refusal-path-reached', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  expectReached(await runScenario(), 'ROW-090 control');
});

test('ROW-090-every-check-response-carries-cache-control-no-store', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expectReached(s, 'ROW-090');
  expect(
    s.answers.map((a) => ({ what: a.what, status: a.status, noStore: noStore(a.cacheControl), cacheControl: a.cacheControl })),
    'ROW-090: every answer to a check request carries Cache-Control: no-store',
  ).toEqual(s.answers.map((a) => ({ what: a.what, status: a.status, noStore: true, cacheControl: a.cacheControl })));
});

for (const engine of ['chromium', 'firefox', 'webkit'] as const) {
  test(`ROW-090-marker-absent-from-the-http-cache-after-leaving-and-reopening-the-page-in-${engine}`, async ({ playwright }) => {
    test.setTimeout(300_000);
    asActor('anonymous');
    const rng = freshRandom();
    const offer = markerOffer(rng);
    const needles = needleForms(offer, rng);
    const dir = mkdtempSync('/tmp/vid-row090-profile-');
    try {
      const type: BrowserType = playwright[engine];
      const context = await type.launchPersistentContext(dir, {
        baseURL: PRODUCT_URL,
        locale: 'es-ES',
        ...(engine === 'firefox'
          ? { firefoxUserPrefs: { 'browser.cache.disk.enable': true, 'browser.cache.disk.parent_directory': dir + '/disk-cache' } }
          : {}),
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await openChecker(page);
      await enterOffer(page, offer.text);
      const { status } = await pressCheck(page);
      let shown: string[] = [];
      await expect
        .poll(async () => (shown = (await readHighlights(page, offer.text)).filter((h) => h.visible).map((h) => h.word)), {
          message: `ROW-090 reach (${engine}): the page highlights the marker word ${offer.unknown.word} (check answered ${status})`,
          timeout: 15_000,
        })
        .toContain(offer.unknown.word);
      await page.goto('/privacidad', { waitUntil: 'load' });
      await openChecker(page);
      await context.close();
      // the engine's HTTP cache: the profile's cache folders (Chromium Cache/, Firefox cache2 or the folder
      // set above, WebKit's network cache) — never its session or form-history files, which are other rows'
      const found = searchLocalDirectory(dir, needles, /cache/i);
      expect(found.files, `ROW-090 control (${engine}): the browser keeps an HTTP cache in its profile, with files to search`).toBeGreaterThan(0);
      expect(found.matches, `ROW-090 (${engine}): after a marker check, leaving and reopening the page, no file of the browser's HTTP cache holds a form of the markers (shown: ${shown.join(', ')})`).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
