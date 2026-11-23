// Purpose: ROW-110 (REQ-025, REQ-002) — the page's built assets are named by content hash and the page
// itself is served no-cache; a check answer the page cannot parse, or of another format version, shows the
// could-not-run message and never a no-errors result; plus a control where a valid empty answer does show
// the no-errors result.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-025,
// REQ-002 and D-020 (the answer's format version `v: 1`). Unreadable answers are played in the browser
// (Playwright route) in place of the page's own POST /api/check; the offer's non-word is fresh per run.
//
// Test argument
// ROW-110 promise: after a deploy no stale page or script can misread an answer: assets are named by
//   content hash, the page is served no-cache, and an answer the page cannot parse or of another format
//   version shows the could-not-run message, never a no-errors result (REQ-025 fail-if "shows a no-errors
//   result"; REQ-002 fail-if "an offer with no misspelling shows no message" read with D-020's `v`).
// ROW-110 wrong product: a page that reads `flagged` without checking `v`, so a {"v": 2, "flagged": []}
//   answer from a newer server (or an answer missing `flagged`) is drawn as "no spelling errors found";
//   a page that shows nothing or a script error on an HTML answer from a proxy or captive portal; assets
//   served as /assets/main.js so a browser keeps an old script against a new server; the page cached.
// ROW-110 given: the page loaded; and an offer with a fresh non-word whose check is answered 200 with an
//   HTML page, with {"v": 2, "flagged": []}, with {"flagged": []}, with {"v": 1, "flagged": {}} or with
//   an empty body; when: Revisar ortografía is pressed; then: the could-not-run message is shown, no
//   count line, no no-errors wording, no highlight, the box untouched. For the assets: the page's
//   Cache-Control says no-cache or no-store, it references at least one script under /assets/, and every
//   asset it references is named with a hash segment and served 200.
// ROW-110 controls: the control answers {"v": 1, "flagged": []} the same way and the page shows its
//   result line with no could-not-run message — the route reaches the page, and the no-errors result the
//   target forbids is really what a naive page draws.
// ROW-110 technique: a fake of the server checked against the real contract (D-020's shape and version),
//   one near miss per way an answer can be unreadable, the version-2 answer being the one a naive page
//   passes; the browser is the boundary because the result line is paint.
// cases: ROW-110 target=ROW-110-an-answer-of-another-format-version-shows-the-could-not-run-message-never-no-errors control=ROW-110-control-a-valid-empty-answer-shows-the-result-line-and-no-could-not-run-message

import { expect, test, type Page } from '@playwright/test';
import { CHECK_PATH, PRODUCT_URL, ROLES, asActor, enterOffer, freshRandom, openChecker, readHighlights } from './harness';
import { COULD_NOT_RUN, NO_ERRORS, offerValue, ordinaryOffer, pressCheckButton, visibleText } from './server-limits-helpers';

async function answerWith(page: Page, answer: { contentType: string; body: string }): Promise<void> {
  await page.route(
    (url) => url.pathname === CHECK_PATH,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({ status: 200, contentType: answer.contentType, body: answer.body });
    },
  );
}

async function unreadable(page: Page, name: string, answer: { contentType: string; body: string }): Promise<void> {
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = ordinaryOffer(rng);
  await openChecker(page);
  await answerWith(page, answer);
  await enterOffer(page, text);
  expect(await visibleText(page, ROLES.message), `ROW-110 (${name}): no could-not-run message before the press`).not.toMatch(COULD_NOT_RUN);

  await pressCheckButton(page, 'none'); // answered by the route; nothing reaches the product
  await expect
    .poll(() => visibleText(page, ROLES.message), { message: `ROW-110 (${name}): the page shows the could-not-run message`, timeout: 15_000 })
    .toMatch(COULD_NOT_RUN);
  const message = await visibleText(page, ROLES.message);
  expect(
    {
      noErrors: NO_ERRORS.test(message),
      countLine: await visibleText(page, ROLES.count),
      highlights: (await readHighlights(page, text)).length,
      box: await offerValue(page),
    },
    `ROW-110 (${name}): never a no-errors result, nothing highlighted, the text untouched ("${message}")`,
  ).toEqual({ noErrors: false, countLine: '', highlights: 0, box: text });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

test('ROW-110-an-answer-of-another-format-version-shows-the-could-not-run-message-never-no-errors', async ({ page }) => {
  await unreadable(page, 'format version 2', { contentType: 'application/json', body: JSON.stringify({ v: 2, flagged: [] }) });
});

test('ROW-110-an-answer-with-no-format-version-shows-the-could-not-run-message-never-no-errors', async ({ page }) => {
  await unreadable(page, 'no version', { contentType: 'application/json', body: JSON.stringify({ flagged: [] }) });
});

test('ROW-110-an-answer-whose-flags-are-not-a-list-shows-the-could-not-run-message-never-no-errors', async ({ page }) => {
  await unreadable(page, 'flags not a list', { contentType: 'application/json', body: JSON.stringify({ v: 1, flagged: {} }) });
});

test('ROW-110-an-html-answer-shows-the-could-not-run-message-never-no-errors', async ({ page }) => {
  await unreadable(page, 'an HTML page', { contentType: 'text/html', body: '<!doctype html><title>Conectando</title><p>Conectando a la red…</p>' });
});

test('ROW-110-an-empty-answer-shows-the-could-not-run-message-never-no-errors', async ({ page }) => {
  await unreadable(page, 'an empty body', { contentType: 'application/json', body: '' });
});

test('ROW-110-control-a-valid-empty-answer-shows-the-result-line-and-no-could-not-run-message', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = ordinaryOffer(rng);
  await openChecker(page);
  await answerWith(page, { contentType: 'application/json', body: JSON.stringify({ v: 1, flagged: [] }) });
  await enterOffer(page, text);
  await pressCheckButton(page, 'none');
  await expect
    .poll(() => visibleText(page, ROLES.count), { message: 'ROW-110 control: a valid answer with no flags shows the result line', timeout: 15_000 })
    .not.toBe('');
  expect(await visibleText(page, ROLES.message), 'ROW-110 control: no could-not-run message for a valid answer').not.toMatch(COULD_NOT_RUN);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('ROW-110-assets-are-named-by-content-hash-and-the-page-is-served-no-cache', async ({ page }) => {
  asActor('anonymous');
  const nav = await page.goto('/', { waitUntil: 'load' });
  expect(nav, 'ROW-110: the page answers').not.toBeNull();
  const cacheControl = (await nav!.allHeaders())['cache-control'] ?? '';
  expect(cacheControl, 'ROW-110: the page is served no-cache').toMatch(/no-cache|no-store/i);

  const assets = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]')).map((n) => ({
      kind: n.tagName.toLowerCase(),
      url: (n as HTMLScriptElement).src || (n as HTMLLinkElement).href,
    })),
  );
  const own = assets.filter((a) => new URL(a.url).origin === new URL(PRODUCT_URL).origin && new URL(a.url).pathname.startsWith('/assets/'));
  expect(own.some((a) => a.kind === 'script'), `ROW-110: the page loads its script from /assets/ (found ${JSON.stringify(assets)})`).toBe(true);

  // A hash segment: 8 or more letters and digits between separators, not a plain lower-case word.
  const hashed = (name: string) => name.split(/[.\-_]/).some((seg) => /^[A-Za-z0-9]{8,}$/.test(seg) && !/^[a-z]+$/.test(seg));
  const unhashed = own.map((a) => new URL(a.url).pathname.split('/').pop() ?? '').filter((name) => !hashed(name));
  expect(unhashed, 'ROW-110: every asset the page loads is named by its content hash').toEqual([]);

  const statuses = await Promise.all(own.map(async (a) => ({ url: new URL(a.url).pathname, status: (await page.request.get(a.url)).status() })));
  expect(statuses.filter((s) => s.status !== 200), 'ROW-110: every hashed asset the page names is served').toEqual([]);
});
