// Purpose: shared setup for the server-limits batch (the length limit, the per-address limit, the
// could-not-run and blank-box behaviour, malformed and foreign requests, start-up readiness) — exact-length
// offers, a raw HTTP door that sends any bytes and headers, a second-address door, and the page readers
// those rows assert with. Every door here reaches the product the way the world does; none reads its source.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits); expected values
// are built here before anything is sent (lengths, positions, fresh words), never read from the product.
//
// Contract: what a docstring says a function never does, it never does. Every check sent from the tests
// container's address goes through the harness's shared check budget (D-030); a check sent from a second
// address (inside the product's own container, from a loopback address of its own) does not, because it
// is not counted against the tests container's address.

import { request as httpRequest } from 'node:http';
import { expect, type Page } from '@playwright/test';
import {
  CHECK_PATH,
  PRODUCT_URL,
  ROLES,
  accentPopulation,
  compose,
  el,
  fillerWords,
  freshNonWord,
  placeOf,
  byPosition,
  productContainer,
  takeCheckSlot,
  type CheckAnswer,
  type Placed,
  type Rng,
} from './harness';

const PRODUCT = new URL(PRODUCT_URL);
/** The product's host and port inside the harness, for the raw doors. */
export const PRODUCT_HOST = PRODUCT.hostname;
export const PRODUCT_PORT = Number(PRODUCT.port || (PRODUCT.protocol === 'https:' ? 443 : 80));
/** The page's own origin, as a browser on the checker page sends it (scheme, host and port). */
export const PRODUCT_ORIGIN = PRODUCT.origin;

/** REQ-021's limit, in characters as a person sees them (A-045). */
export const CHARACTER_LIMIT = 10_000;
/** REQ-022's limit: checks a minute from one network address. */
export const PER_MINUTE = 30;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Characters as a person sees them (A-045) ────────────────────────────────────────────────────

const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });

/** Counts extended grapheme clusters (UAX #29) — "an emoji or an accented letter counting as one" (A-045). */
export function graphemeCount(text: string): number {
  let n = 0;
  for (const _ of graphemes.segment(text)) n++;
  return n;
}

/** Code points, for the setup guards that show the counting units really differ in a text. */
export function codePointCount(text: string): number {
  return Array.from(text).length;
}

// ─── Offers ──────────────────────────────────────────────────────────────────────────────────────

/**
 * An offer of exactly `length` characters (UTF-16 units, code points and graphemes all equal: filler
 * words of the harness, BMP and precomposed), opening with `first` and closing with `last`, every word
 * between them a correctly spelled filler. Returns the text and where `first` and `last` stand. Fails
 * `setup:` when the three counts disagree. It never pads with trailing spaces.
 */
export function offerOfLength(rng: Rng, length: number, ends: { first: string; last: string }): { text: string; first: Placed; last: Placed } {
  const fillers = fillerWords();
  const tokens = [ends.first];
  let len = ends.first.length;
  const tail = 1 + ends.last.length;
  for (;;) {
    const w = rng.pick(fillers);
    if (len + 1 + w.length + tail > length) break;
    tokens.push(w);
    len += 1 + w.length;
  }
  tokens.push(ends.last);
  len += tail;
  const separators = tokens.slice(1).map(() => ' ');
  let gap = length - len;
  if (gap < 0 || gap >= separators.length) throw new Error(`setup: offerOfLength cannot reach ${length} characters (gap ${gap})`);
  // widen `gap` separators from " " to ", " (one character each), never the one before `last`
  const slots = rng.shuffle(separators.slice(0, -1).map((_, i) => i));
  for (const i of slots) {
    if (gap === 0) break;
    separators[i] = ', ';
    gap--;
  }
  const { text, placed } = compose(tokens, separators);
  if (text.length !== length || graphemeCount(text) !== length || codePointCount(text) !== length) {
    throw new Error(`setup: offerOfLength built ${text.length} units / ${graphemeCount(text)} characters, wanted ${length}`);
  }
  return { text, first: placed[0], last: placed[placed.length - 1] };
}

/** Emoji a writer pastes: single, skin-toned, ZWJ sequences, a flag, a variation-selector heart. */
const EMOJI = ['👍', '👍🏽', '👩‍💻', '👨‍👩‍👧‍👦', '🇪🇸', '❤️', '🎉', '🙋🏻‍♀️'];

/**
 * An offer of exactly `count` characters as a person sees them (A-045) whose code units, code points and
 * bytes all exceed `count` by far: accented dictionary words written DECOMPOSED (NFD: a letter followed by
 * U+0301), emoji of every common shape (skin tones, ZWJ families, flags), and "…" (which compatibility
 * normalisation turns into three characters). Returns the text and its counts in every unit. Fails
 * `setup:` when the grapheme count is not exactly `count`. It never contains a line break.
 */
export function offerOfGraphemes(rng: Rng, count: number): { text: string; units: number; codePoints: number; bytes: number; afterNfkc: number } {
  const words = accentPopulation().map((p) => p.word.normalize('NFD'));
  let text = '';
  let n = 0;
  for (let i = 0; ; i++) {
    let token: string;
    if (i % 2 === 1) token = rng.pick(EMOJI);
    else token = rng.pick(words) + (rng.int(6) === 0 ? '…' : '');
    const cost = graphemeCount(token) + (text ? 1 : 0);
    if (n + cost > count) break;
    text += (text ? ' ' : '') + token;
    n += cost;
  }
  while (n < count) {
    text += '👍'; // directly after the last token: exactly one more character
    n++;
  }
  const got = graphemeCount(text);
  if (got !== count) throw new Error(`setup: offerOfGraphemes built ${got} characters, wanted ${count}`);
  return {
    text,
    units: text.length,
    codePoints: codePointCount(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    afterNfkc: graphemeCount(text.normalize('NFKC')),
  };
}

/**
 * An ordinary short offer: correctly spelled filler words with one fresh non-word among them (a word no
 * dictionary, rule or exemption holds, new every run). Returns the text and where the non-word stands —
 * so a check that really ran flags exactly it.
 */
export function ordinaryOffer(rng: Rng): { text: string; nonWord: Placed } {
  const fillers = fillerWords();
  const before = 2 + rng.int(4);
  const after = 1 + rng.int(3);
  const tokens: string[] = [];
  for (let i = 0; i < before; i++) tokens.push(rng.pick(fillers));
  tokens.push(freshNonWord(rng));
  for (let i = 0; i < after; i++) tokens.push(rng.pick(fillers));
  const { text, placed } = compose(tokens);
  return { text, nonWord: placed[before] };
}

// ─── Reading a check endpoint's answer ───────────────────────────────────────────────────────────

/** The D-020 answer in `body`, or null when the body is not one (a refusal, an error page, garbage). */
export function asCheckAnswer(body: string): CheckAnswer | null {
  let a: unknown;
  try {
    a = JSON.parse(body);
  } catch {
    return null;
  }
  const x = a as Partial<CheckAnswer> | null;
  const ok =
    x !== null &&
    typeof x === 'object' &&
    x.v === 1 &&
    Array.isArray(x.flagged) &&
    x.flagged.every((f) => f !== null && typeof f === 'object' && Number.isInteger(f.start) && Number.isInteger(f.end) && typeof f.word === 'string');
  return ok ? (x as CheckAnswer) : null;
}

/** The flags of an answer reduced to where they stand, sorted — for exact comparison with `Placed` lists. */
export function flagsOf(answer: CheckAnswer): Placed[] {
  return byPosition(answer.flagged.map(placeOf));
}

/**
 * A refusal: the request was not checked — a client-error status (4xx) or 503 (the could-not-run
 * answer), with no D-020 answer in the body. A 200, a crash (500, 502) or no answer is not a refusal.
 */
export function isRefusal(res: { status: number | null; body?: string }): boolean {
  if (res.status === null) return false;
  const refusedStatus = (res.status >= 400 && res.status < 500) || res.status === 503;
  return refusedStatus && asCheckAnswer(res.body ?? '') === null;
}

/** Traces of the server's insides that a plain refusal must not carry (framework codes, paths, stacks, parser messages). */
export const INTERNALS =
  /FST_[A-Z_]+|[Ff]astify|node_modules|\/srv\/|\/app\/|dist\/|src\/|\.[jt]s:\d|\bat [\w$.<>]+ \(|Error:|TypeError|SyntaxError|RangeError|Unexpected (?:token|end|character)|in JSON at position|is not valid JSON|ECONN|EPIPE|errno|\bstack\b/;

// ─── Raw HTTP door (the tests container's address) ───────────────────────────────────────────────

export type Raw = { status: number; headers: Record<string, string>; body: string; ms: number };

/**
 * Sends one HTTP request to the product with exactly these bytes and headers (a string body is sent as
 * UTF-8, a Buffer byte for byte; Content-Length is set from the body unless given) and returns status,
 * headers (lower-case names) and body untouched, with the milliseconds to the end of the answer. A POST
 * to the check endpoint takes a check slot first: `slot` 'wait' (default) paces it on the shared budget,
 * 'no-wait' records it without waiting (inside `holdCheckBudget`). It never adds a content type, never
 * retries, never follows a redirect, never reuses a connection; it rejects only when no answer arrives
 * within `timeoutMs` (default 60 s) or the connection fails before any answer.
 */
export async function rawRequest(opts: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  slot?: 'wait' | 'no-wait';
  timeoutMs?: number;
}): Promise<Raw> {
  const method = (opts.method ?? 'POST').toUpperCase();
  const path = opts.path ?? CHECK_PATH;
  if (method === 'POST' && path === CHECK_PATH) await takeCheckSlot({ wait: (opts.slot ?? 'wait') === 'wait' });
  const body = opts.body === undefined ? undefined : Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body, 'utf8');
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (body && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-length')) headers['content-length'] = String(body.length);
  const timeoutMs = opts.timeoutMs ?? 60_000;
  return new Promise<Raw>((resolve, reject) => {
    const t0 = Date.now();
    let settled = false;
    const req = httpRequest({ host: PRODUCT_HOST, port: PRODUCT_PORT, method, path, headers, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const h: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) h[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        resolve({ status: res.statusCode ?? 0, headers: h, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - t0 });
      };
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', done);
      res.on('aborted', done);
      res.on('error', done);
      res.on('close', done);
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(new Error(`no answer to ${method} ${path} within ${timeoutMs / 1000} s`));
    }, timeoutMs);
    req.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${method} ${path} failed before any answer: ${(e as Error).message}`));
    });
    if (body) req.write(body);
    req.end();
  });
}

// ─── Second-address door (inside the product's container, from a loopback address of its own) ────

const DOCKER_SOCKET = '/var/run/docker.sock';

function docker(method: string, path: string, body?: unknown, timeoutMs = 120_000): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = httpRequest(
      {
        socketPath: DOCKER_SOCKET,
        method,
        path,
        headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`setup: the Docker engine did not answer ${method} ${path} within ${timeoutMs / 1000} s`)));
    req.on('error', (e) => reject(new Error(`setup: the Docker engine at ${DOCKER_SOCKET} is unreachable (${e.message})`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function demux(buf: Buffer): { stdout: string; stderr: string } {
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const kind = buf[i];
    const size = buf.readUInt32BE(i + 4);
    if (kind > 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0 || i + 8 + size > buf.length) {
      return { stdout: buf.toString('utf8'), stderr: '' };
    }
    (kind === 2 ? err : out).push(buf.subarray(i + 8, i + 8 + size));
    i += 8 + size;
  }
  return { stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') };
}

/**
 * Runs `node -e <script> <args…>` inside the product's container (the operator door's exec, as the
 * container's own user, in its working directory, with its environment) and returns what it printed and
 * its exit code. Fails `setup:` when the engine refuses the exec. It never starts, stops or changes the
 * product's container or its process; what the script does is the caller's.
 */
export async function execInProduct(script: string, args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { id } = await productContainer();
  const created = await docker('POST', `/containers/${id}/exec`, { AttachStdout: true, AttachStderr: true, Tty: false, Cmd: ['node', '-e', script, ...args] });
  if (created.status !== 201) throw new Error(`setup: the product container refused an exec (status ${created.status}): ${created.body.toString('utf8').slice(0, 200)}`);
  const execId = (JSON.parse(created.body.toString('utf8')) as { Id: string }).Id;
  const started = await docker('POST', `/exec/${execId}/start`, { Detach: false, Tty: false }, timeoutMs);
  const { stdout, stderr } = demux(started.body);
  const inspected = await docker('GET', `/exec/${execId}/json`);
  const exitCode = (JSON.parse(inspected.body.toString('utf8')) as { ExitCode: number | null }).ExitCode;
  return { stdout, stderr, exitCode };
}

// Sends requests to the product's own port on 127.0.0.1 from the given local (loopback) addresses — the
// whole 127.0.0.0/8 block is the container's own, so each is a distinct client address to the server.
const SEND_SCRIPT = `
const http = require('http');
const spec = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
const port = Number(process.env.PORT || 8080);
function one(r) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const body = r.body === undefined ? undefined : Buffer.from(r.body, 'utf8');
    const headers = Object.assign({}, r.headers || {});
    if (body) headers['content-length'] = String(body.length);
    let done = false;
    const finish = (x) => { if (!done) { done = true; resolve(Object.assign({ ms: Date.now() - t0 }, x)); } };
    const req = http.request({ host: '127.0.0.1', port, method: r.method || 'POST', path: r.path || '/api/check', headers, localAddress: r.localAddress, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => finish({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8').slice(0, 20000) }));
    });
    req.setTimeout(spec.timeoutMs || 30000, () => { req.destroy(); finish({ status: null, error: 'no answer within ' + (spec.timeoutMs || 30000) + ' ms' }); });
    req.on('error', (e) => finish({ status: null, error: e.code || e.message }));
    if (body) req.write(body);
    req.end();
  });
}
(async () => {
  const out = spec.concurrent ? await Promise.all(spec.requests.map(one)) : [];
  if (!spec.concurrent) for (const r of spec.requests) out.push(await one(r));
  process.stdout.write(JSON.stringify(out));
})();
`;

export type AddressedRequest = { localAddress: string; method?: string; path?: string; headers?: Record<string, string>; body?: string };
export type AddressedAnswer = { status: number | null; body?: string; error?: string; ms: number };

/**
 * The second-address door: sends each request from inside the product's container to the product's own
 * port, from the given loopback source address (127.x.y.z — a client address other than the tests
 * container's), in order (or all at once with `concurrent`), and returns each status, body and the
 * milliseconds from sending to the end of the answer, timed inside the container. It never takes a check
 * slot (the tests container's address is not the sender) and never sends a forwarding header unless asked.
 */
export async function sendFromAddresses(requests: AddressedRequest[], opts: { concurrent?: boolean; timeoutMs?: number } = {}): Promise<AddressedAnswer[]> {
  const spec = Buffer.from(JSON.stringify({ requests, concurrent: !!opts.concurrent, timeoutMs: opts.timeoutMs ?? 30_000 }), 'utf8').toString('base64');
  const { stdout, stderr, exitCode } = await execInProduct(SEND_SCRIPT, [spec], (opts.timeoutMs ?? 30_000) * Math.max(1, opts.concurrent ? 1 : requests.length) + 30_000);
  if (exitCode !== 0) throw new Error(`setup: the second-address door exited ${exitCode}: ${stderr.slice(0, 300)}`);
  try {
    return JSON.parse(stdout) as AddressedAnswer[];
  } catch {
    throw new Error(`setup: the second-address door's report is unreadable: ${stdout.slice(0, 200)} ${stderr.slice(0, 200)}`);
  }
}

/** A fresh loopback client address in 127.0.0.0/8, never 127.0.0.1 (the healthcheck's own). */
export function freshLoopback(rng: Rng): string {
  return `127.${1 + rng.int(250)}.${rng.int(256)}.${2 + rng.int(250)}`;
}

/** A JSON check body for the second-address door, with its content type. */
export function checkRequestFrom(localAddress: string, text: string): AddressedRequest {
  return { localAddress, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) };
}

// ─── Page readers (the engine door; D-021 identifiers) ───────────────────────────────────────────

/** One POST /api/check the page sent: the text it carried (null when the body was no JSON text) and its answer's status (null while unanswered, -1 when it failed). */
export type SeenCheck = { text: string | null; status: number | null };

/**
 * Records every POST /api/check the page sends from now on, with the text it carried and the status of
 * its answer — the page's own traffic, as the network sees it. It never alters, delays or answers one.
 */
export function watchChecks(page: Page): SeenCheck[] {
  const seen: SeenCheck[] = [];
  const index = new Map<unknown, SeenCheck>();
  page.on('request', (r) => {
    if (r.method() !== 'POST' || new URL(r.url()).pathname !== CHECK_PATH) return;
    let text: string | null = null;
    try {
      const t = (JSON.parse(r.postData() ?? '') as { text?: unknown }).text;
      text = typeof t === 'string' ? t : null;
    } catch {
      text = null;
    }
    const s: SeenCheck = { text, status: null };
    seen.push(s);
    index.set(r, s);
  });
  page.on('response', (res) => {
    const s = index.get(res.request());
    if (s) s.status = res.status();
  });
  page.on('requestfailed', (r) => {
    const s = index.get(r);
    if (s) s.status = -1;
  });
  return seen;
}

/**
 * Presses the check button (data-element="check") the way the device does — a tap on a touch device, a
 * click otherwise — after taking a check slot per `slot` ('wait' paces on the shared budget, 'no-wait'
 * records without waiting inside a hold, 'none' takes none: for a press whose request never reaches the
 * product). Unlike the harness's pressCheck it never waits for a request: the rows here include presses
 * that must send none.
 */
export async function pressCheckButton(page: Page, slot: 'wait' | 'no-wait' | 'none'): Promise<void> {
  if (slot !== 'none') await takeCheckSlot({ wait: slot === 'wait' });
  const button = el(page, ROLES.check).first();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await button.tap({ timeout: 15_000 });
  else await button.click({ timeout: 15_000 });
}

/**
 * The visible text of every element carrying data-element="<role>" (rendered, not hidden, not fully
 * transparent), trimmed and joined by " | "; '' when none shows any. One evaluation, no waiting.
 */
export async function visibleText(page: Page, role: string): Promise<string> {
  return page.evaluate((r: string) => {
    return Array.from(document.querySelectorAll(`[data-element="${r}"]`))
      .filter((n) => {
        const e = n as HTMLElement;
        const cs = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
      })
      .map((n) => ((n as HTMLElement).innerText ?? '').trim())
      .filter((t) => t.length > 0)
      .join(' | ');
  }, role);
}

/** The text the offer box holds now — its value for a text field, its text for an editable element. */
export async function offerValue(page: Page): Promise<string> {
  return el(page, ROLES.offer)
    .first()
    .evaluate((n) => {
      const box = n.matches('textarea, input') ? n : n.querySelector('textarea, input');
      if (box) return (box as HTMLTextAreaElement | HTMLInputElement).value;
      return (n as HTMLElement).innerText;
    });
}

/** Everything the page shows as text (document.body.innerText). */
export async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? '');
}

/** Waits (15 s) until the visible text of `role` matches `pattern`, failing with `message`. */
export async function expectShown(page: Page, role: string, pattern: RegExp, message: string, timeout = 15_000): Promise<void> {
  await expect.poll(() => visibleText(page, role), { message, timeout }).toMatch(pattern);
}

// ─── What the writer reads (Spanish page; A-013, A-016, A-027, A-045) ────────────────────────────

/** A message naming the 10,000-character limit: "10.000", "10 000" or "10000" (A-013). */
export const NAMES_THE_LIMIT = /10[.,\s\u00a0\u202f\u2009]?000/;
/** A message asking to wait (A-013: "refused with a message to wait a moment"). */
export const ASKS_TO_WAIT = /esper|momento|instante|en breve|más tarde|minuto/i;
/** The could-not-run message's first half: the check could not be done (A-016). */
export const COULD_NOT_RUN =
  /no se (?:ha )?pod|no se pudo|no hemos podido|no ha sido posible|no fue posible|no se puede|no podemos|no está disponible|no disponible|fall[óo]|ha fallado|(?:ocurrido|producido|habido) un (?:error|problema)|hubo un (?:error|problema)/i;
/** The could-not-run message's second half: try again in a moment (A-016). */
export const TRY_AGAIN = /momento|de nuevo|otra vez|más tarde|nuevamente|vuelv[ae]|intent|prueb[ae]|instante|en breve/i;
/** The no-errors result's wording (A-005: "No spelling errors found"). */
export const NO_ERRORS = /no se (?:han )?encontr|sin errores|ningún error|ninguna falta|\b0 errores|cero errores|no hay errores|no hay faltas/i;
/** The prompt to write or paste an offer (A-027). */
export const ASKS_FOR_AN_OFFER = /escrib|pega|pegu|introduc|añad/i;
/** Technical error text a writer must never be shown (status codes, reason phrases, script errors). */
export const TECHNICAL =
  /\b(?:400|413|429|500|502|503|504)\b|Internal Server Error|Bad Gateway|Gateway Timeout|Service Unavailable|Too Many Requests|Payload Too Large|TypeError|SyntaxError|ReferenceError|Failed to fetch|NetworkError|Load failed|AbortError|Unexpected token|JSON\.parse|\bundefined\b|\bnull\b|\bNaN\b|\[object /;
