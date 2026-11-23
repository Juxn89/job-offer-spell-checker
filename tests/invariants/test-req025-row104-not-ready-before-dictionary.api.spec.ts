// Purpose: ROW-104 (REQ-025, REQ-002) — no check is answered against a partly loaded dictionary: a fresh
// server process, started the way the harness starts the product, refuses checks and reports not ready
// until it is ready, and every check it answers — before or after — is answered against the whole
// dictionary.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits). The start
// command is the harness contract's (docker-compose.test.yml: `node dist/server/main.js`, PORT); the
// expected flags come from the dictionary oracle (dictionary-es 4.0.0, pinned) and a fresh non-word,
// never from the product.
//
// Test argument
// ROW-104 promise: until the dictionary is loaded and the self-check of the fixed sample text passes,
//   checks get the could-not-run answer and the server reports not ready (the row; REQ-025 a check that
//   cannot run is refused, never shown as a result; REQ-002 a no-errors message only for an offer with
//   no misspelling).
// ROW-104 wrong product: a server that listens before its dictionary is loaded and answers checks with
//   no flags (an empty or half-built word list reads as "no spelling errors found"), or whose /healthz
//   says ready as soon as the port is open while the dictionary or the term list is still loading.
// ROW-104 given: inside the product's container, a second server process started on a fresh port with
//   the container's own environment; from the moment it is spawned, /healthz polled every 20 ms and,
//   until it reports ready, a check sent every 40 ms (at most 25) of an offer holding twenty-five
//   accented dictionary words from across the dictionary, fillers and one fresh non-word; once /healthz
//   answers 200, one more check; when/then: every check answered 200 is a D-020 answer flagging exactly
//   the non-word at its offsets (none answered against a partial word list), every check not answered
//   200 came before readiness, /healthz reports ready within 60 s, and the check sent once it is ready
//   is answered 200 that way.
// ROW-104 controls: the control case shows the start-up window was observed — the first /healthz probe
//   of the fresh process did not answer 200 — so the target saw the process before it was ready.
// ROW-104 technique: the process's own entry point (the boundary rule: a process is proved at its own
//   entry point), observed from spawn; the expectation is the dictionary oracle's, independent of the
//   product's checker.
// cases: ROW-104 target=ROW-104-no-check-is-answered-against-a-partly-loaded-dictionary-and-readiness-waits-for-it control=ROW-104-control-the-fresh-process-is-observed-before-it-is-ready

import { expect, test } from '@playwright/test';
import { accentPopulation, asActor, compose, fillerWords, freshNonWord, freshRandom, type Placed, type Rng } from './harness';
import { asCheckAnswer, execInProduct, flagsOf } from './server-limits-helpers';

const READY_WITHIN_MS = 60_000;

// Runs inside the product's container: spawns the product's start command on a fresh port with the
// container's environment, polls it from spawn, and reports what it saw; kills the process at the end.
const START_SCRIPT = `
const http = require('http');
const { spawn } = require('child_process');
const spec = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
const child = spawn(spec.command[0], spec.command.slice(1), { env: Object.assign({}, process.env, { PORT: String(spec.port) }), stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', (d) => { if (output.length < 4000) output += d; });
child.stderr.on('data', (d) => { if (output.length < 4000) output += d; });
let exited = null;
child.on('exit', (code, signal) => { exited = { code, signal }; });
const t0 = Date.now();
function req(method, path, body) {
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : Buffer.from(body, 'utf8');
    const headers = payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {};
    let done = false;
    const finish = (x) => { if (!done) { done = true; resolve(Object.assign({ t: Date.now() - t0 }, x)); } };
    const r = http.request({ host: '127.0.0.1', port: spec.port, method, path, headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => finish({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8').slice(0, 20000) }));
    });
    r.setTimeout(10000, () => { r.destroy(); finish({ status: null, error: 'no answer within 10 s' }); });
    r.on('error', (e) => finish({ status: null, error: e.code || e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const log = { healthz: [], checks: [], readyAt: null, exited: null, output: '' };
  let lastCheck = -1e9;
  try {
    while (Date.now() - t0 < spec.readyWithinMs && !exited) {
      const h = await req('GET', '/healthz');
      log.healthz.push({ t: h.t, status: h.status, error: h.error });
      if (h.status === 200) { log.readyAt = h.t; break; }
      if (log.checks.length < spec.maxBeforeReady && Date.now() - lastCheck >= spec.checkEveryMs) {
        lastCheck = Date.now();
        const c = await req('POST', '/api/check', JSON.stringify({ text: spec.text }));
        log.checks.push(Object.assign({ phase: 'before ready' }, c));
      }
      await sleep(spec.pollMs);
    }
    if (log.readyAt !== null) {
      const c = await req('POST', '/api/check', JSON.stringify({ text: spec.text }));
      log.checks.push(Object.assign({ phase: 'once ready' }, c));
    }
  } finally {
    log.exited = exited;
    log.output = output.slice(0, 2000);
    try { child.kill('SIGKILL'); } catch (e) {}
    process.stdout.write(JSON.stringify(log));
    process.exit(0);
  }
})();
`;

type Probe = { t: number; status: number | null; error?: string };
type CheckSeen = Probe & { phase: 'before ready' | 'once ready'; body?: string };
type StartLog = { healthz: Probe[]; checks: CheckSeen[]; readyAt: number | null; exited: unknown; output: string };

function offerAcrossTheDictionary(rng: Rng): { text: string; nonWord: Placed } {
  const words = rng.shuffle(accentPopulation()).slice(0, 25).map((p) => p.word);
  const fillers = fillerWords();
  const nonWord = freshNonWord(rng);
  const at = rng.int(words.length);
  const tokens: string[] = [];
  words.forEach((w, i) => {
    if (i === at) tokens.push(nonWord);
    tokens.push(w, rng.pick(fillers));
  });
  const { text, placed } = compose(tokens);
  return { text, nonWord: placed.find((p) => p.word === nonWord)! };
}

async function startFresh(rng: Rng, text: string): Promise<StartLog> {
  const spec = {
    command: ['node', 'dist/server/main.js'],
    port: 20_000 + rng.int(20_000),
    text,
    readyWithinMs: READY_WITHIN_MS,
    pollMs: 20,
    checkEveryMs: 40,
    maxBeforeReady: 25,
  };
  const { stdout, stderr, exitCode } = await execInProduct(START_SCRIPT, [Buffer.from(JSON.stringify(spec), 'utf8').toString('base64')], READY_WITHIN_MS + 60_000);
  if (exitCode !== 0) throw new Error(`setup: the start-up observer exited ${exitCode}: ${stderr.slice(0, 300)}`);
  try {
    return JSON.parse(stdout) as StartLog;
  } catch {
    throw new Error(`setup: the start-up observer's report is unreadable: ${stdout.slice(0, 200)} ${stderr.slice(0, 200)}`);
  }
}

test('ROW-104-no-check-is-answered-against-a-partly-loaded-dictionary-and-readiness-waits-for-it', async () => {
  test.setTimeout(240_000);
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = offerAcrossTheDictionary(rng);
  const log = await startFresh(rng, text);

  expect(log.readyAt, `ROW-104: the fresh process reports ready within ${READY_WITHIN_MS / 1000} s (exited: ${JSON.stringify(log.exited)}; output: ${log.output.slice(0, 300)})`).not.toBeNull();
  const wrongAnswers = log.checks
    .filter((c) => c.status === 200)
    .map((c) => {
      const a = asCheckAnswer(c.body ?? '');
      return { phase: c.phase, t: c.t, flagged: a ? flagsOf(a) : 'not a D-020 answer' };
    })
    .filter((c) => JSON.stringify(c.flagged) !== JSON.stringify([nonWord]));
  const unansweredOnceReady = log.checks.filter((c) => c.phase === 'once ready' && c.status !== 200).map((c) => ({ status: c.status, error: c.error, body: (c.body ?? '').slice(0, 120) }));
  expect(
    { answeredAgainstAPartialWordList: wrongAnswers, refusedOnceReady: unansweredOnceReady },
    `ROW-104: every check the fresh process answers flags exactly "${nonWord.word}" — none answered before the dictionary was whole — and the check once ready is answered (seed ${rng.seed}; checks seen: ${JSON.stringify(log.checks.map((c) => ({ phase: c.phase, t: c.t, status: c.status })))})`,
  ).toEqual({ answeredAgainstAPartialWordList: [], refusedOnceReady: [] });
});

test('ROW-104-control-the-fresh-process-is-observed-before-it-is-ready', async () => {
  test.setTimeout(240_000);
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = offerAcrossTheDictionary(rng);
  const log = await startFresh(rng, text);
  expect(
    { observedBeforeReady: log.healthz.length > 0 && log.healthz[0].status !== 200, becameReady: log.readyAt !== null },
    `ROW-104 control: the fresh process is seen not ready before it is ready (first probes: ${JSON.stringify(log.healthz.slice(0, 3))}; output: ${log.output.slice(0, 300)})`,
  ).toEqual({ observedBeforeReady: true, becameReady: true });
});
