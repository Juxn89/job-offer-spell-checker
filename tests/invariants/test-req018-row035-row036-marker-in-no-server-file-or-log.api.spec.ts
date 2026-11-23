// Purpose: ROW-035 and ROW-036 (REQ-018) — after checks of a marker offer, including a 10,001-character
// refusal, a rate-limit refusal, malformed requests and a check that dies mid-body, the markers are in no file
// of any harness service container and in no log line any of them wrote, in any searched form.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-018's fail-if,
// A-008, D-024 and D-025; fresh markers per run (privacy-text-helpers.markerOffer); no expected value comes
// from the product.
//
// Test argument
// ROW-035 promise: after checks of an offer carrying a unique marker — a 10,001-character refusal, a rate-limit
//   refusal, a malformed request among them — the marker is in no file anywhere in the server (and proxy)
//   containers, searched as plain, escaped, base64 and lower-cased forms, rotated logs decompressed (REQ-018
//   fail-if; A-008 "never stored or logged"; D-024 the operator door; D-003 no storage of any kind).
// ROW-035 wrong product: a server that writes each refused or malformed request's body to an error file (a
//   "rejected-requests.log", rotated to .gz) or keeps a JSON-escaped/base64 copy of the text in a cache file,
//   while answering every check correctly.
// ROW-035 given: one fresh marker offer (an unknown word that is flagged, a title-case pseudo-name, a phrase of
//   five accented dictionary words); when: it is checked normally, sent at 10,001 characters, sent as two
//   malformed bodies, sent and cut off mid-body, and sent until the per-address limit refuses it; then: the
//   whole-disk search of every harness service container but the tests runner finds none of its forms.
// ROW-035 controls: the normal check returned exactly the offer's two misspellings at their places (the text
//   reached the checker), the oversize, malformed and over-limit sends were each refused (each path reached),
//   and the same search found the container's own hostname in /etc/hostname (the search reads files).
// ROW-035 technique: a planted fresh marker searched for in every encoding a leak could take, over the whole
//   filesystem, from outside the product process (the operator door) — absence asserted only after the
//   controls show the paths were exercised. Honest limits: the forced checker failure of the row's wording has
//   no public trigger (returned as owed), and the proxy container joins the search when the harness adds it
//   (D-025), with no change here.
//
// ROW-036 promise: after the same checks, the marker is in no application, proxy, access or error log line and
//   in no error report (REQ-018 fail-if "in any log or error report"; A-008).
// ROW-036 wrong product: a server whose request logger prints the request body on a 4xx (or the parse error's
//   message, which quotes the offending JSON), or prints the flagged words at debug level.
// ROW-036 given, when: as ROW-035; then: no searched form of any marker is in the log stream of any harness
//   service but the tests runner, read after the logs stop growing, nor in any file of their containers (where
//   a log file or an error report would be written).
// ROW-036 controls: as ROW-035 — the paths were reached and the file search reads files.
// ROW-036 technique: the same planted markers, searched in the containers' own log streams (docker logs, rotated
//   files included) and on disk.
// cases: ROW-036 target=ROW-036-marker-in-no-log-line-or-error-report-after-checks-refusals-and-malformed-requests control=ROW-035-ROW-036-control-each-check-path-was-reached-and-the-search-reads-files
// cases: ROW-035 target=ROW-035-marker-in-no-file-of-any-server-container-after-checks-refusals-and-malformed-requests control=ROW-035-ROW-036-control-each-check-path-was-reached-and-the-search-reads-files

import { expect, test } from '@playwright/test';
import {
  asActor,
  byPosition,
  freshRandom,
  holdCheckBudget,
  placeOf,
  PRODUCT_URL,
  sendRaw,
  type CheckAnswer,
} from './harness';
import {
  foundIn,
  markerOffer,
  needleForms,
  oversizeMarkerText,
  searchServiceFiles,
  sendInterruptedCheck,
  serviceLogs,
  settleLogs,
  type ContainerFileSearch,
  type MarkerOffer,
  type Needle,
} from './privacy-text-helpers';

type Scenario = {
  offer: MarkerOffer;
  needles: Needle[];
  normal: { status: number; flagged: unknown };
  oversize: number;
  malformed: number[];
  overLimit: { accepted: number; refusedWith: number | null };
  files: ContainerFileSearch[];
  logs: { service: string; text: string }[];
};

let scenario: Promise<Scenario> | undefined;

// One run of the row's checks per worker, shared by the three cases (they promise about the same checks).
function runScenario(): Promise<Scenario> {
  scenario ??= (async () => {
    const rng = freshRandom();
    const offer = markerOffer(rng);
    const needles = needleForms(offer, rng);
    const began = Date.now();
    const hold = await holdCheckBudget();
    let normal: Scenario['normal'];
    let oversize: number;
    const malformed: number[] = [];
    const overLimit: Scenario['overLimit'] = { accepted: 0, refusedWith: null };
    try {
      // 1. the normal check
      const n = await sendRaw({ body: { text: offer.text }, pace: false });
      let flagged: unknown = null;
      try {
        flagged = byPosition(((JSON.parse(n.body) as CheckAnswer).flagged ?? []).map(placeOf));
      } catch {
        flagged = `unparsable: ${n.body.slice(0, 200)}`;
      }
      normal = { status: n.status, flagged };
      if (n.status === 200) overLimit.accepted++;
      // 2. the 10,001-character refusal
      const o = await sendRaw({ body: { text: oversizeMarkerText(offer, rng) }, pace: false });
      oversize = o.status;
      if (o.status === 200) overLimit.accepted++;
      // 3. malformed requests: a JSON body cut short, and a body with no "text" (D-020: 400)
      const cut = JSON.stringify({ text: offer.text });
      malformed.push((await sendRaw({ body: cut.slice(0, cut.length - 2), headers: { 'content-type': 'application/json' }, pace: false })).status);
      malformed.push((await sendRaw({ body: { offer: offer.text }, pace: false })).status);
      // 4. a check that fails mid-body (the connection dies)
      await sendInterruptedCheck(PRODUCT_URL, offer.text, false);
      // 5. the marker offer again, until the per-address limit refuses it (REQ-022: 30 a minute)
      for (let i = 0; i < 32 && overLimit.refusedWith === null && overLimit.accepted <= 30; i++) {
        const r = await sendRaw({ body: { text: offer.text }, pace: false });
        if (r.status === 200) overLimit.accepted++;
        else overLimit.refusedWith = r.status;
      }
    } finally {
      await hold.release();
    }
    await settleLogs();
    const files = await searchServiceFiles(needles, began);
    const logs = await serviceLogs();
    return { offer, needles, normal, oversize, malformed, overLimit, files, logs };
  })();
  return scenario;
}

function expectPathsReached(s: Scenario, row: string): void {
  expect(
    {
      normalCheck: s.normal,
      oversizeRefused: s.oversize >= 400 && s.oversize < 500,
      malformedRefused: s.malformed.map((st) => st >= 400 && st < 500),
      overLimitRefused: s.overLimit.refusedWith !== null && s.overLimit.refusedWith >= 400 && s.overLimit.refusedWith < 500,
    },
    `${row} reach: the marker offer was checked (its two misspellings flagged at their places), the 10,001-character send refused (status ${s.oversize}), both malformed sends refused (${s.malformed.join(', ')}), and a send past the limit refused (${s.overLimit.accepted} accepted, then ${s.overLimit.refusedWith ?? 'no refusal'})`,
  ).toEqual({
    normalCheck: { status: 200, flagged: s.offer.flagged },
    oversizeRefused: true,
    malformedRefused: [true, true],
    overLimitRefused: true,
  });
}

test('ROW-035-ROW-036-control-each-check-path-was-reached-and-the-search-reads-files', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expect(
    s.files.map((f) => ({ service: f.service, readsFiles: f.filesScanned > 100, findsItsHostname: f.controlFoundIn.includes('/etc/hostname') })),
    'ROW-035/ROW-036 control: the whole-disk search read every service container and found each one\'s hostname in /etc/hostname',
  ).toEqual(s.files.map((f) => ({ service: f.service, readsFiles: true, findsItsHostname: true })));
  expectPathsReached(s, 'ROW-035/ROW-036');
});

test('ROW-035-marker-in-no-file-of-any-server-container-after-checks-refusals-and-malformed-requests', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expectPathsReached(s, 'ROW-035');
  expect(
    s.files.map((f) => ({ service: f.service, matches: f.matches, undecodedRecentCompressedFiles: f.undecodedRecent })),
    `ROW-035: no form of the markers (${s.needles.length} forms of ${s.offer.unknown.word}, ${s.offer.name.word}, "${s.offer.phrase.word}") is in any file of any server container, compressed files decompressed`,
  ).toEqual(s.files.map((f) => ({ service: f.service, matches: [], undecodedRecentCompressedFiles: [] })));
});

test('ROW-036-marker-in-no-log-line-or-error-report-after-checks-refusals-and-malformed-requests', async () => {
  test.setTimeout(600_000);
  asActor('anonymous');
  const s = await runScenario();
  expectPathsReached(s, 'ROW-036');
  const inLogs = s.logs.map((l) => ({
    service: l.service,
    forms: foundIn(l.text, s.needles),
    lines: l.text.split('\n').filter((line) => foundIn(line, s.needles).length > 0).slice(0, 5),
  }));
  expect(
    inLogs,
    `ROW-036: no log line of any service holds a form of the markers ${s.offer.unknown.word}, ${s.offer.name.word}, "${s.offer.phrase.word}"`,
  ).toEqual(s.logs.map((l) => ({ service: l.service, forms: [], lines: [] })));
  expect(
    s.files.map((f) => ({ service: f.service, logOrReportFiles: f.matches.map((m) => m.path) })),
    'ROW-036: no file of any server container — a log file or an error report — holds a form of the markers',
  ).toEqual(s.files.map((f) => ({ service: f.service, logOrReportFiles: [] })));
});
