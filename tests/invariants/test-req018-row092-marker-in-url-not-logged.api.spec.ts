// Purpose: ROW-092 (REQ-018) — requests carrying marker text in their path or query string, refused or not
// found (and one served page), leave no form of the markers in any log line or any file (error report) of
// the harness's service containers: logs record paths without query strings, and never a marker path.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if,
// A-008 and D-024; fresh markers per run; no expected value comes from the product.
//
// Test argument
// ROW-092 promise: a request carrying the marker in its path or query string, refused or not found, leaves the
//   marker in no log line and no error report; logs record paths without query strings (REQ-018 fail-if "in
//   any log or error report"; A-008 "never stored or logged").
// ROW-092 wrong product: a server whose not-found handler logs the full request URL (path and query) at warn
//   level, or whose access log prints `req.url` — so an offer a writer's tool once put in a URL lands in the
//   log; or one that logs the refused check's query string in its operator line.
// ROW-092 given: fresh markers (an unknown word, a title-case pseudo-name, an accented phrase); when: GET of a
//   marker path (404), GET of a marker asset name with a marker query (404), POST to a marker path under the
//   check endpoint (404), GET of the percent-encoded phrase as a path (404), GET of the privacy note with a
//   marker query (served), POST of a malformed check with a marker query (refused) and POST of a
//   10,001-character check of plain filler words with a marker query (refused); then: after the logs settle,
//   no form of any marker — plain, case, percent-encoded, base64 — is in any service's log or in any file of
//   its container.
// ROW-092 controls: each request got its intended answer — the not-found ones 404, the served page 200, the
//   two checks refused with a 4xx — so the not-found, served and refusal paths were each reached.
// ROW-092 technique: planted fresh markers on the URL side only (the bodies carry none), searched in every
//   encoding in the containers' log streams and on disk, from outside the product (the operator door).
// cases: ROW-092 target=ROW-092-marker-in-path-or-query-in-no-log-line-and-no-error-report control=ROW-092-control-each-marker-url-request-reached-its-not-found-served-or-refused-answer

import { expect, test } from '@playwright/test';
import { asActor, CHECK_PATH, fillerWords, freshRandom, sendRaw, takeCheckSlot } from './harness';
import { foundIn, markerOffer, needleForms, searchServiceFiles, serviceLogs, settleLogs, type ContainerFileSearch, type MarkerOffer, type Needle } from './privacy-text-helpers';

type Sent = { what: string; status: number; expected: 'not found' | 'served' | 'refused' };
type Scenario = { offer: MarkerOffer; needles: Needle[]; sent: Sent[]; logs: { service: string; text: string }[]; files: ContainerFileSearch[] };

let scenario: Promise<Scenario> | undefined;

function runScenario(): Promise<Scenario> {
  scenario ??= (async () => {
    const rng = freshRandom();
    const offer = markerOffer(rng);
    const needles = needleForms(offer, rng);
    const began = Date.now();
    const u = offer.unknown.word;
    const n = offer.name.word;
    const p = encodeURIComponent(offer.phrase.word);
    const sent: Sent[] = [];
    const go = async (what: string, expected: Sent['expected'], opts: Parameters<typeof sendRaw>[0]) => {
      sent.push({ what, expected, status: (await sendRaw(opts)).status });
    };
    await go('GET a marker path', 'not found', { method: 'GET', path: `/${u}/${n}` });
    await go('GET a marker asset with a marker query', 'not found', { method: 'GET', path: `/assets/${u}.js?${n}=${p}` });
    await takeCheckSlot();
    await go('POST under the check endpoint to a marker path', 'not found', { method: 'POST', path: `${CHECK_PATH}/${u}`, body: { text: 'hola' } });
    await go('GET the percent-encoded phrase as a path', 'not found', { method: 'GET', path: `/${p}` });
    await go('GET the privacy note with a marker query', 'served', { method: 'GET', path: `/privacidad?q=${u}&n=${n}&p=${p}` });
    await takeCheckSlot();
    await go('POST a malformed check with a marker query', 'refused', { method: 'POST', path: `${CHECK_PATH}?q=${u}&n=${n}&p=${p}`, body: { offer: 'hola' } });
    const fillers = fillerWords();
    let long = 'buscamos';
    while (long.length < 10_001) long += ' ' + rng.pick(fillers);
    long = long.slice(0, 10_001).replace(/\s$/, 'a');
    await takeCheckSlot();
    await go('POST a 10,001-character check with a marker query', 'refused', { method: 'POST', path: `${CHECK_PATH}?q=${u}&n=${n}&p=${p}`, body: { text: long } });
    await settleLogs();
    const logs = await serviceLogs();
    const files = await searchServiceFiles(needles, began);
    return { offer, needles, sent, logs, files };
  })();
  return scenario;
}

const reached = (s: Sent) =>
  s.expected === 'not found' ? s.status === 404 : s.expected === 'served' ? s.status === 200 : s.status >= 400 && s.status < 500;

function expectReached(s: Scenario, row: string): void {
  expect(
    s.sent.map((x) => ({ what: x.what, reached: reached(x), status: x.status })),
    `${row} reach: each marker-URL request got its answer (not found 404, served 200, refused 4xx)`,
  ).toEqual(s.sent.map((x) => ({ what: x.what, reached: true, status: x.status })));
}

test('ROW-092-control-each-marker-url-request-reached-its-not-found-served-or-refused-answer', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expect(
    s.files.map((f) => ({ service: f.service, findsItsHostname: f.controlFoundIn.includes('/etc/hostname') })),
    'ROW-092 control: the file search reads every service container (its hostname found in /etc/hostname)',
  ).toEqual(s.files.map((f) => ({ service: f.service, findsItsHostname: true })));
  expectReached(s, 'ROW-092 control');
});

test('ROW-092-marker-in-path-or-query-in-no-log-line-and-no-error-report', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expectReached(s, 'ROW-092');
  expect(
    s.logs.map((l) => ({
      service: l.service,
      forms: foundIn(l.text, s.needles),
      lines: l.text.split('\n').filter((line) => foundIn(line, s.needles).length > 0).slice(0, 5),
    })),
    `ROW-092: no log line holds a marker (${s.offer.unknown.word}, ${s.offer.name.word}, "${s.offer.phrase.word}") from a path or query string`,
  ).toEqual(s.logs.map((l) => ({ service: l.service, forms: [], lines: [] })));
  expect(
    s.files.map((f) => ({ service: f.service, matches: f.matches })),
    'ROW-092: no file of any service container — an error report or a log file — holds a marker from a path or query string',
  ).toEqual(s.files.map((f) => ({ service: f.service, matches: [] })));
});
