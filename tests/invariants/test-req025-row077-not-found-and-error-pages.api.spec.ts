// Purpose: ROW-077 (REQ-025) — over HTTP, an unknown path answers a plain Spanish not-found page with a
// link back to the checker, and no error answer the product gives (unknown paths, a wrong method, a
// malformed or refused check) reveals a stack trace, a file path or a framework name.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch shell) from ROW-077's
// obligation and REQ-025; the unknown paths are fresh per run (freshMarker), Spanish is judged by the
// dictionary oracle (dictionary-es 4.0.0, D-029), and no expected value comes from the product.
//
// Test argument
// ROW-077 promise: "An unknown path returns a plain Spanish not-found page with a link back to the
//   checker, and no error page reveals a stack trace, a file path or a framework name" (the row's own
//   obligation, derived from REQ-025: a failure "shows a technical error" fails it; A-016: a plain
//   message, never a technical one; D-020: a check body without a string text answers 400).
// ROW-077 wrong product: the framework's default not-found answer — `{"message":"Route GET:/x not
//   found","error":"Not Found","statusCode":404}` or "Cannot GET /x", in English, with no way back — or
//   a not-found page that is Spanish but answers 200 or links nowhere; and, for the second case, an error
//   handler that sends the exception to the visitor (a stack with /app/dist/… paths, an FST_ERR_… code,
//   an `x-powered-by: Express` header) for a malformed, oversized or wrongly typed check body.
// ROW-077 given: four fresh unknown paths outside the check endpoint (a top-level page, a nested file,
//   an asset, a page under the privacy note's path); when: each is fetched; then: each answers 404 with
//   an HTML page whose <html lang> is Spanish, whose visible text is non-empty and holds no word the
//   Spanish dictionary lacks, and which links to the checker's root address — and that link, followed,
//   answers 200 with the checker page (its text box and button, D-021).
// ROW-077 given (leaks): twelve error-provoking requests — unknown paths, a path traversal under
//   /assets/, a malformed percent-escape, a wrong method on the page and on the check endpoint, and five
//   refused checks (malformed JSON, no text, a non-string text, an XML body, a 1.6 MB body); then: each
//   answers an error status (the error path was reached) and neither its body nor its header values
//   carry a stack frame, an error class, a file-system path, a source location, or a framework's or
//   runtime's name or error code.
// ROW-077 controls: GET / answers 200 with the checker page — the product is up and a known path is not
//   answered as unknown, so a red target is about the not-found page, not about a dead product; the
//   leak case's own "is an error status" assertion shows each error path was reached.
// ROW-077 technique: decoys and fresh values — fresh unknown paths no product can special-case, a
//   near-miss link (to the privacy note, or to the unknown path itself) that does not count as the way
//   back; Spanish judged by the independent dictionary oracle rather than by one wording, so any plain
//   Spanish message passes and English or a JSON dump fails; HTTP boundary (R6: a served page and its
//   status need no paint).
// cases: ROW-077 target=ROW-077-an-unknown-path-returns-a-plain-spanish-not-found-page-linking-back-to-the-checker control=ROW-077-control-the-checker-page-answers-200-with-its-text-box

import { expect, test } from '@playwright/test';
import { asActor, CHECK_PATH, freshMarker, PRODUCT_URL, sendRaw } from './harness';
import { htmlLang, htmlLinks, htmlVisibleText, isCheckerAddress, leaksIn, spanishReading } from './shell-helpers';

const isCheckerPage = (body: string) => /data-element\s*=\s*["']?offer\b/.test(body) && /data-element\s*=\s*["']?check\b/.test(body);

test('ROW-077-an-unknown-path-returns-a-plain-spanish-not-found-page-linking-back-to-the-checker', async () => {
  asActor('anonymous');
  const m = freshMarker();
  const paths = [`/${m}`, `/${m}/${freshMarker()}.html`, `/assets/${m}.js`, `/privacidad/${m}`];

  const report: Record<string, unknown> = {};
  const expected: Record<string, unknown> = {};
  for (const path of paths) {
    const res = await sendRaw({ method: 'GET', path });
    const url = PRODUCT_URL + path;
    const lang = htmlLang(res.body);
    const text = htmlVisibleText(res.body);
    const { words, foreign } = spanishReading(text);
    const links = htmlLinks(res.body);
    const back = links.filter((h) => isCheckerAddress(h, url));
    let backAnswers = 'no link back';
    if (back.length) {
      const followed = await sendRaw({ method: 'GET', path: new URL(back[0], url).pathname });
      backAnswers = followed.status === 200 && isCheckerPage(followed.body) ? 'the checker page' : `${followed.status}, not the checker page`;
    }
    report[path] = {
      status: res.status,
      html: /^text\/html\b/i.test(res.headers['content-type'] ?? ''),
      langIsSpanish: lang !== null && /^es\b/i.test(lang),
      hasVisibleText: words.length > 0,
      wordsNotSpanish: foreign,
      linkBackToTheChecker: backAnswers,
    };
    expected[path] = {
      status: 404,
      html: true,
      langIsSpanish: true,
      hasVisibleText: true,
      wordsNotSpanish: [],
      linkBackToTheChecker: 'the checker page',
    };
  }
  expect(
    report,
    `ROW-077: each unknown path answers 404 with a plain Spanish HTML page linking back to the checker (${PRODUCT_URL}/)`,
  ).toEqual(expected);
});

test('ROW-077-no-error-page-reveals-a-stack-trace-a-file-path-or-a-framework-name', async () => {
  asActor('anonymous');
  const m = freshMarker();
  const json = { 'content-type': 'application/json' };
  const probes: { label: string; method: string; path: string; body?: unknown; headers?: Record<string, string> }[] = [
    { label: 'unknown page', method: 'GET', path: `/${m}` },
    { label: 'unknown nested file', method: 'GET', path: `/${m}/${freshMarker()}.php` },
    { label: 'unknown asset', method: 'GET', path: `/assets/${m}.js` },
    { label: 'asset path traversal', method: 'GET', path: '/assets/..%2f..%2fpackage.json' },
    { label: 'malformed percent-escape', method: 'GET', path: `/${m}%zz` },
    { label: 'wrong method on the page', method: 'DELETE', path: '/' },
    { label: 'GET on the check endpoint', method: 'GET', path: CHECK_PATH },
    { label: 'malformed JSON check', method: 'POST', path: CHECK_PATH, body: '{"text": "', headers: json },
    { label: 'check with no text', method: 'POST', path: CHECK_PATH, body: {} },
    { label: 'check with a non-string text', method: 'POST', path: CHECK_PATH, body: { text: 12345 } },
    { label: 'check sent as XML', method: 'POST', path: CHECK_PATH, body: '<text>hola</text>', headers: { 'content-type': 'application/xml' } },
    { label: 'check of a 1.6 MB body', method: 'POST', path: CHECK_PATH, body: JSON.stringify({ text: 'hola '.repeat(320_000) }), headers: json },
  ];

  const report: Record<string, { errorStatus: boolean | number; leaks: string[] }> = {};
  const expected: Record<string, { errorStatus: boolean | number; leaks: string[] }> = {};
  for (const p of probes) {
    const res = await sendRaw({ method: p.method, path: p.path, body: p.body, headers: p.headers });
    report[p.label] = { errorStatus: res.status >= 400 && res.status <= 599 ? true : res.status, leaks: leaksIn(res) };
    expected[p.label] = { errorStatus: true, leaks: [] };
  }
  expect(
    report,
    'ROW-077: every error-provoking request answers an error status, and no error answer reveals a stack trace, a file path or a framework name',
  ).toEqual(expected);
});

test('ROW-077-control-the-checker-page-answers-200-with-its-text-box', async () => {
  asActor('anonymous');
  const res = await sendRaw({ method: 'GET', path: '/' });
  expect(res.status, 'ROW-077 control: the checker page answers 200').toBe(200);
  expect(isCheckerPage(res.body), 'ROW-077 control: GET / is the checker page (data-element="offer" and "check", D-021)').toBe(true);
});
