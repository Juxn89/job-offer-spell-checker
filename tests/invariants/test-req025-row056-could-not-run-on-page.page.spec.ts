// Purpose: ROW-056 (REQ-025) — on the checker page, in every browser of the harness, when the checker
// cannot run (a server error, the server down behind the proxy or unreachable, a gateway timeout, no answer
// at all) the page shows the plain could-not-run message, never a technical error or a no-errors result,
// and the text stays in the box untouched; plus a control with the checker running.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-025's
// fail-if and A-016. The failing checker is played in the browser (Playwright route) against the real
// contract — the page's own POST /api/check (D-020), answered as a failing server or proxy answers it;
// the control uses the real product. The error body's marker and the offer's non-word are fresh per run.
//
// Test argument
// ROW-056 promise: "when the checker cannot run, the page shows a plain message that the check could not
//   run and to try again in a moment, and the writer's text stays in the box untouched" (REQ-025; A-016);
//   fail-if: no message, a technical error, a no-errors result, or the text changed or cleared.
// ROW-056 wrong product: a page that treats any answer without flags as "no errors" (a failure read as a
//   clean offer — the harm REQ-025 serves), one that prints the server's error body or "Failed to fetch",
//   one that waits forever on a check that never answers, or one that clears the box on failure.
// ROW-056 given: an offer holding a fresh non-word in the box; the page's check request answered 500
//   with a technical body carrying a fresh marker (server error), 502 with an empty body (server down
//   behind the proxy), refused at the connection (server down), 504 (the proxy's timeout), or never
//   answered (timeout); when: Revisar ortografía is pressed; then: a visible message says the check
//   could not run and to try again, no count line and no highlight are shown, nothing the page shows
//   carries a status code, reason phrase, script error or the marker, and the box holds the offer.
// ROW-056 controls: before the press no could-not-run message is shown; the control case, with the real
//   checker running, shows a result line and the non-word highlighted and no could-not-run message — so
//   a page that always shows the message fails it.
// ROW-056 technique: a fake of the failing server, checked against the real contract (the page's own
//   request, answered in the shapes a failing server and its proxy really produce), one case per way of
//   not running, so a page handling only one of them is caught.
// cases: ROW-056 target=ROW-056-a-server-error-shows-the-could-not-run-message-and-the-text-stays control=ROW-056-control-with-the-checker-running-a-result-is-shown-and-no-could-not-run-message

import { expect, test, type Page, type Route } from '@playwright/test';
import { CHECK_PATH, ROLES, asActor, enterOffer, freshMarker, freshRandom, openChecker, pressCheck, readHighlights } from './harness';
import {
  COULD_NOT_RUN,
  NO_ERRORS,
  TECHNICAL,
  TRY_AGAIN,
  offerValue,
  ordinaryOffer,
  pageText,
  pressCheckButton,
  visibleText,
} from './server-limits-helpers';

type Failure = 'server-error' | 'down-behind-proxy' | 'unreachable' | 'gateway-timeout' | 'no-answer';

/** The longest a writer is left without a message when the check never answers. */
const NO_ANSWER_BOUND_MS = 60_000;

async function failingChecker(page: Page, failure: Failure, marker: string): Promise<void> {
  await page.route(
    (url) => url.pathname === CHECK_PATH,
    async (route: Route) => {
      if (route.request().method() !== 'POST') return route.continue();
      switch (failure) {
        case 'server-error':
          return route.fulfill({
            status: 500,
            contentType: 'text/plain',
            body: `Error: ${marker} at Object.check (/srv/dist/server/main.js:42:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)`,
          });
        case 'down-behind-proxy':
          return route.fulfill({ status: 502, body: '' });
        case 'unreachable':
          return route.abort('connectionrefused');
        case 'gateway-timeout':
          return route.fulfill({ status: 504, body: '' });
        case 'no-answer':
          return; // never fulfilled: the check hangs until the page gives up on it
      }
    },
  );
}

async function couldNotRun(page: Page, failure: Failure): Promise<void> {
  asActor('anonymous');
  const rng = freshRandom();
  const marker = freshMarker();
  const { text } = ordinaryOffer(rng);
  await openChecker(page);
  await failingChecker(page, failure, marker);
  await enterOffer(page, text);
  expect(await visibleText(page, ROLES.message), `ROW-056 (${failure}): no could-not-run message before the press`).not.toMatch(COULD_NOT_RUN);

  await pressCheckButton(page, 'none'); // the request never reaches the product: the route answers it
  await expect
    .poll(() => visibleText(page, ROLES.message), {
      message: `ROW-056 (${failure}): the page says the check could not run`,
      timeout: failure === 'no-answer' ? NO_ANSWER_BOUND_MS : 15_000,
    })
    .toMatch(COULD_NOT_RUN);
  const message = await visibleText(page, ROLES.message);
  const shown = await pageText(page);
  expect(
    {
      asksToTryAgain: TRY_AGAIN.test(message),
      noErrorsResult: NO_ERRORS.test(message),
      countLine: await visibleText(page, ROLES.count),
      technical: (shown.match(TECHNICAL) ?? [])[0] ?? null,
      markerShown: shown.includes(marker),
      highlights: (await readHighlights(page, text)).length,
      box: await offerValue(page),
    },
    `ROW-056 (${failure}): the plain could-not-run message ("${message}"), no technical error, no no-errors result, the text untouched`,
  ).toEqual({ asksToTryAgain: true, noErrorsResult: false, countLine: '', technical: null, markerShown: false, highlights: 0, box: text });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

test('ROW-056-a-server-error-shows-the-could-not-run-message-and-the-text-stays', async ({ page }) => {
  await couldNotRun(page, 'server-error');
});

test('ROW-056-a-server-down-behind-the-proxy-shows-the-could-not-run-message-and-the-text-stays', async ({ page }) => {
  await couldNotRun(page, 'down-behind-proxy');
});

test('ROW-056-an-unreachable-server-shows-the-could-not-run-message-and-the-text-stays', async ({ page }) => {
  await couldNotRun(page, 'unreachable');
});

test('ROW-056-a-gateway-timeout-shows-the-could-not-run-message-and-the-text-stays', async ({ page }) => {
  await couldNotRun(page, 'gateway-timeout');
});

test('ROW-056-a-check-that-never-answers-shows-the-could-not-run-message-and-the-text-stays', async ({ page }) => {
  test.setTimeout(180_000);
  await couldNotRun(page, 'no-answer');
});

test('ROW-056-control-with-the-checker-running-a-result-is-shown-and-no-could-not-run-message', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = ordinaryOffer(rng);
  await openChecker(page);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, 'ROW-056 control: the real checker answers').toBe(200);
  await expect
    .poll(async () => (await readHighlights(page, text)).map((h) => ({ word: h.word, start: h.start, end: h.end })), {
      message: `ROW-056 control: the non-word "${nonWord.word}" is highlighted`,
      timeout: 15_000,
    })
    .toEqual([nonWord]);
  expect(await visibleText(page, ROLES.count), 'ROW-056 control: a result line is shown').not.toBe('');
  expect(await visibleText(page, ROLES.message), 'ROW-056 control: no could-not-run message when the checker runs').not.toMatch(COULD_NOT_RUN);
});
