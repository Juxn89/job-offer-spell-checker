// Purpose: ROW-089 (REQ-039) — a check request carrying another website's Origin, or a content type other
// than JSON, is refused, and no response of the product carries an Access-Control-Allow-Origin naming
// another origin or the wildcard; plus a control where the page's own origin, and no origin at all, are
// answered.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-039's
// fail-if and A-038; foreign origins and non-words are fresh per run; the page's own origin is the
// harness's PRODUCT_URL.
//
// Test argument
// ROW-089 promise: "a check request carrying another website's origin is accepted, or any response
//   allows another website's pages to read it" fails REQ-039 (A-038: other websites may not call the
//   checker from their own pages); the row adds the content-type door a cross-site form or a "simple"
//   fetch uses without any preflight.
// ROW-089 wrong product: a server with no Origin check (any site's script spends its visitors' per-address
//   allowance on our checker); one that checks only that the Origin contains or starts with its own host
//   (http://product.test:8080.evil.example passes); one that accepts text/plain or form bodies, which a
//   browser sends cross-site with no preflight; one whose CORS layer echoes any Origin or answers "*".
// ROW-089 given: an ordinary offer with a fresh non-word; when: it is POSTed as JSON with Origin a fresh
//   foreign site, "null", the page's origin with a foreign suffix, and a foreign host ending in the
//   page's host; and with no Origin but Content-Type text/plain, form-urlencoded and multipart; and the
//   preflight and the page's GET routes are requested with a foreign Origin; then: every such check is
//   refused (4xx, no D-020 answer), and no response at all carries Access-Control-Allow-Origin other
//   than the page's own origin.
// ROW-089 controls: the control case sends the same offer as JSON with the page's own Origin, and with
//   no Origin (the outside probe, D-008) — both answered 200 with the non-word flagged; a server that
//   refuses everything fails it.
// ROW-089 technique: one near miss per way an origin check is commonly wrong (substring, prefix,
//   "null"), and the neighbouring entity — the page's own origin — that must stay served.
// cases: ROW-089 target=ROW-089-check-requests-with-a-foreign-origin-or-a-non-json-type-are-refused-and-no-response-allows-another-origin control=ROW-089-control-checks-from-the-pages-own-origin-or-with-no-origin-are-answered

import { expect, test } from '@playwright/test';
import { asActor, freshMarker, freshRandom } from './harness';
import { PRODUCT_HOST, PRODUCT_ORIGIN, PRODUCT_PORT, asCheckAnswer, flagsOf, isRefusal, ordinaryOffer, rawRequest, type Raw } from './server-limits-helpers';

const allowsAnother = (r: Raw) => {
  const acao = r.headers['access-control-allow-origin'];
  return acao !== undefined && acao.trim() !== PRODUCT_ORIGIN;
};

test('ROW-089-check-requests-with-a-foreign-origin-or-a-non-json-type-are-refused-and-no-response-allows-another-origin', async () => {
  test.setTimeout(300_000);
  asActor('anonymous');
  const rng = freshRandom();
  const foreign = `https://${freshMarker()}.example`;
  const { text } = ordinaryOffer(rng);
  const json = JSON.stringify({ text });

  const checks: { name: string; headers: Record<string, string>; body: string }[] = [
    { name: 'a foreign site', headers: { origin: foreign, 'content-type': 'application/json' }, body: json },
    { name: 'origin "null"', headers: { origin: 'null', 'content-type': 'application/json' }, body: json },
    { name: 'own origin with a foreign suffix', headers: { origin: `${PRODUCT_ORIGIN}.${freshMarker()}.example`, 'content-type': 'application/json' }, body: json },
    { name: 'a foreign host ending in our host', headers: { origin: `http://${freshMarker()}${PRODUCT_HOST}:${PRODUCT_PORT}`, 'content-type': 'application/json' }, body: json },
    { name: 'text/plain, no origin', headers: { 'content-type': 'text/plain' }, body: json },
    { name: 'form-urlencoded, no origin', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `text=${encodeURIComponent(text)}` },
    {
      name: 'multipart, no origin',
      headers: { 'content-type': 'multipart/form-data; boundary=vidboundary' },
      body: `--vidboundary\r\nContent-Disposition: form-data; name="text"\r\n\r\n${text}\r\n--vidboundary--\r\n`,
    },
  ];
  const accepted: string[] = [];
  const allowing: string[] = [];
  for (const c of checks) {
    const res = await rawRequest({ headers: c.headers, body: c.body });
    if (!isRefusal(res)) accepted.push(`${c.name}: ${res.status} ${res.body.slice(0, 120)}`);
    if (allowsAnother(res)) allowing.push(`POST ${c.name}: ${res.headers['access-control-allow-origin']}`);
  }

  const others: { method: string; path: string; headers: Record<string, string> }[] = [
    { method: 'OPTIONS', path: '/api/check', headers: { origin: foreign, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } },
    { method: 'GET', path: '/', headers: { origin: foreign } },
    { method: 'GET', path: '/healthz', headers: { origin: foreign } },
    { method: 'GET', path: '/privacidad', headers: { origin: foreign } },
  ];
  for (const o of others) {
    const res = await rawRequest(o);
    if (allowsAnother(res)) allowing.push(`${o.method} ${o.path}: ${res.headers['access-control-allow-origin']}`);
  }

  expect({ accepted, allowing }, 'ROW-089: every foreign-origin or non-JSON check request is refused, and no response lets another origin read it').toEqual({ accepted: [], allowing: [] });
});

test('ROW-089-control-checks-from-the-pages-own-origin-or-with-no-origin-are-answered', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = ordinaryOffer(rng);
  const results: Record<string, unknown>[] = [];
  for (const headers of [{ origin: PRODUCT_ORIGIN, 'content-type': 'application/json' }, { 'content-type': 'application/json; charset=utf-8' }] as Record<string, string>[]) {
    const res = await rawRequest({ headers, body: JSON.stringify({ text }) });
    const answer = res.status === 200 ? asCheckAnswer(res.body) : null;
    results.push({ origin: headers.origin ?? 'none', status: res.status, flagged: answer && flagsOf(answer), allowsAnother: allowsAnother(res) });
  }
  expect(results, 'ROW-089 control: the page\'s own origin, and a request with no origin, are answered with the non-word flagged').toEqual([
    { origin: PRODUCT_ORIGIN, status: 200, flagged: [nonWord], allowsAnother: false },
    { origin: 'none', status: 200, flagged: [nonWord], allowsAnother: false },
  ]);
});
