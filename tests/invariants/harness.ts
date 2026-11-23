// Purpose: the harness client — the one module every ledger test imports. It reaches the product only
// the ways the world does: the API door (the check endpoint over the network), the engine door (the
// page in a real browser, through its real controls), the operator door (the product container's logs
// and files, read the way an operator on the server reads them), plus the actor door, fresh values,
// the shared check budget and the dictionary oracle.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch harness); nothing here is
// produced by, imported from, or read out of the product's source.
//
// Contract for later test-author passes: the exports below and their docstrings ARE the harness;
// what a docstring says a function never does, it never does. Fixture law: every state a test needs
// is made through the product's public paths (these doors) — never by a hand-set flag.
//
// The product, as the harness contract (docker-compose.test.yml) runs it: one service, reached at
// VID_PRODUCT_URL (http://product.test:8080) on an internal network with no route out. Its routes:
// GET / (the checker page), GET /assets/:name, GET /privacidad, POST /api/check (D-020), GET /healthz.

import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

export {
  DICTIONARY_RELEASE,
  accentPopulation,
  hasInclusiveReading,
  isDictionaryWord,
  stripAcuteAccents,
  type AccentPair,
} from './spanish-dictionary';
import { isDictionaryWord as isDictionaryWordLocal } from './spanish-dictionary';

/** The product's base URL inside the harness (the tests service's VID_PRODUCT_URL). */
export const PRODUCT_URL: string = (process.env.VID_PRODUCT_URL ?? 'http://product.test:8080').replace(/\/+$/, '');

/** The check endpoint's path (D-020). */
export const CHECK_PATH = '/api/check';

const DEFAULT_WAIT_MS = 15_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Actor door ──────────────────────────────────────────────────────────────────────────────────

/** The actor kinds of the inventory. The product has no sign-in: one kind, `anonymous`. */
export const ACTORS = ['anonymous'] as const;
export type Actor = (typeof ACTORS)[number];

/**
 * The actor door: puts the test in the row's actor's shoes. `anonymous` needs nothing — the call only
 * checks the actor is one the inventory knows, and fails (`setup:`) on any other. It never sets a
 * cookie, a header or any state of its own.
 */
export function asActor(actor: Actor): void {
  if (!(ACTORS as readonly string[]).includes(actor)) {
    throw new Error(`setup: the harness knows no actor "${actor}" — the product's only actor kind is anonymous`);
  }
}

// ─── Fresh values ────────────────────────────────────────────────────────────────────────────────

export type Rng = {
  /** The seed, recorded on the test as a `seed` annotation; set VID_SEED to replay a run. */
  seed: number;
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (the input is left as it was). */
  shuffle<T>(items: readonly T[]): T[];
};

/**
 * Fresh randomness for one test: a new seed every run (from the OS), so no product can hard-code the
 * values a test derives from it; the seed is pushed as a `seed` annotation on the running test so a
 * failure can be replayed with VID_SEED=<seed>. Never reused across tests.
 */
export function freshRandom(): Rng {
  const fromEnv = process.env.VID_SEED ? Number(process.env.VID_SEED) : NaN;
  const seed = Number.isInteger(fromEnv) ? fromEnv >>> 0 : randomBytes(4).readUInt32BE(0);
  let a = seed;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  try {
    test.info().annotations.push({ type: 'seed', description: String(seed) });
  } catch {
    /* not inside a running test: nothing to annotate */
  }
  return {
    seed,
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('setup: freshRandom().pick was handed an empty list');
      return items[int(items.length)];
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/**
 * A fresh marker: `zvid` followed by 16 random lower-case ASCII letters — one word, unique per call,
 * found nowhere in the product or its dictionary, and unchanged by JSON or HTML escaping. For the
 * privacy rows: place it in an offer, then search for it with the operator door.
 */
export function freshMarker(): string {
  const bytes = randomBytes(16);
  let s = 'zvid';
  for (const b of bytes) s += String.fromCharCode(97 + (b % 26));
  return s;
}

// Everyday job-offer words, all lower case; each is checked against the dictionary oracle on use.
const FILLERS = [
  'buscamos', 'persona', 'equipo', 'experiencia', 'proyectos', 'empresa', 'trabajo', 'perfil',
  'desarrollo', 'clientes', 'ofrecemos', 'contrato', 'jornada', 'completa', 'salario', 'formación',
  'para', 'con', 'del', 'una', 'nuestro', 'de', 'la', 'y', 'en', 'el', 'los', 'las', 'tareas',
  'responsable', 'oficina', 'horario', 'flexible', 'candidatos', 'requisitos', 'valoramos',
];

/**
 * Correctly spelled filler words for building offers: lower-case everyday words of a job offer, every
 * one a dictionary word by the oracle (checked on each call; `setup:` if the oracle disagrees), none
 * a name, an acronym, a term-list word, an inclusive form, ano or anos — so no ratified rule makes
 * any of them flagged. It never returns a misspelling.
 */
export function fillerWords(): string[] {
  const bad = FILLERS.filter((w) => !isDictionaryWordLocal(w));
  if (bad.length) throw new Error(`setup: filler words the dictionary does not hold: ${bad.join(', ')}`);
  return [...FILLERS];
}

/**
 * A fresh non-word: 9 random lower-case consonants (no x, so no inclusive reading), checked against
 * the dictionary oracle — a word no dictionary, rule or exemption holds, unique per run.
 */
export function freshNonWord(rng: Rng): string {
  const consonants = 'bcdfghjklmnpqrstvwz';
  for (;;) {
    let w = '';
    for (let i = 0; i < 9; i++) w += consonants[rng.int(consonants.length)];
    if (!isDictionaryWordLocal(w)) return w;
  }
}

// ─── The check budget (REQ-022: at most 30 checks a minute from one address) ─────────────────────

/** The product's per-address limit (REQ-022): every check this harness sends comes from one address. */
export const CHECKS_PER_MINUTE = 30;
const WINDOW_MS = 62_000; // a minute, plus margin for the time between sending and arriving
const BUDGET_FILE = '/tmp/vid-check-budget.json';
const BUDGET_LOCK = '/tmp/vid-check-budget.lock';
const MAX_BUDGET_WAIT_MS = 180_000;

type Budget = { stamps: number[]; hold?: { pid: number; until: number } };

async function withBudget<T>(fn: (b: Budget) => T): Promise<T> {
  const began = Date.now();
  for (;;) {
    try {
      mkdirSync(BUDGET_LOCK);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(BUDGET_LOCK).mtimeMs > 10_000) rmSync(BUDGET_LOCK, { recursive: true, force: true });
      } catch {
        /* released meanwhile */
      }
      if (Date.now() - began > 30_000) throw new Error('setup: the check-budget lock was not released within 30 s');
      await sleep(15);
    }
  }
  try {
    let b: Budget = { stamps: [] };
    try {
      b = JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budget;
    } catch {
      /* first use in this run */
    }
    const now = Date.now();
    b.stamps = b.stamps.filter((t) => now - t < WINDOW_MS);
    if (b.hold && b.hold.until <= now) delete b.hold;
    const out = fn(b);
    writeFileSync(BUDGET_FILE, JSON.stringify(b));
    return out;
  } finally {
    rmSync(BUDGET_LOCK, { recursive: true, force: true });
  }
}

/**
 * Takes one check from the shared budget before a check is sent, so that the whole ledger — every
 * worker, every browser, all one address to the product — never exceeds CHECKS_PER_MINUTE and a row
 * never fails on a refusal it did not ask for. Waits (polling the budget, bounded at 180 s, then
 * `setup:`) until a slot is free and no other test holds the budget. `{ wait: false }` records the
 * check without waiting — for a test that means to exceed the limit, inside `holdCheckBudget`.
 * Every door below that sends a check calls this itself; call it directly only for a check sent some
 * other way. It never resets or reads the product's own counter.
 */
export async function takeCheckSlot(opts: { wait?: boolean } = {}): Promise<void> {
  const wait = opts.wait ?? true;
  const began = Date.now();
  for (;;) {
    const delay = await withBudget((b) => {
      const now = Date.now();
      const heldByOther = b.hold && b.hold.pid !== process.pid;
      if (!wait || (!heldByOther && b.stamps.length < CHECKS_PER_MINUTE)) {
        b.stamps.push(now);
        return 0;
      }
      if (heldByOther) return 250;
      return Math.max(50, Math.min(...b.stamps) + WINDOW_MS - now);
    });
    if (delay === 0) return;
    if (Date.now() - began > MAX_BUDGET_WAIT_MS) {
      throw new Error(`setup: no check slot came free within ${MAX_BUDGET_WAIT_MS / 1000} s (limit ${CHECKS_PER_MINUTE} a minute from this address)`);
    }
    await sleep(Math.min(delay, 5_000));
  }
}

/**
 * For the rows about the limit itself (REQ-022): waits until no check has been sent from this address
 * for a full window, then holds the budget so no other test sends a check until `release()` is called
 * (or 3 minutes pass). Inside the hold, send checks with `{ pace: false }` (raw door) or
 * `takeCheckSlot({ wait: false })`; they are still recorded, so later tests wait for them to age out.
 * It never changes what the product counts.
 */
export async function holdCheckBudget(): Promise<{ release: () => Promise<void> }> {
  const began = Date.now();
  for (;;) {
    const ready = await withBudget((b) => {
      if (b.hold && b.hold.pid !== process.pid) return false;
      b.hold = { pid: process.pid, until: Date.now() + 180_000 + WINDOW_MS };
      return b.stamps.length === 0;
    });
    if (ready) break;
    if (Date.now() - began > MAX_BUDGET_WAIT_MS) throw new Error('setup: the check budget never came free for a hold');
    await sleep(500);
  }
  return {
    release: () =>
      withBudget((b) => {
        if (b.hold?.pid === process.pid) delete b.hold;
      }),
  };
}

// ─── API door ────────────────────────────────────────────────────────────────────────────────────

/** One flagged word as the check endpoint reports it (D-020): UTF-16 offsets, end exclusive. */
export type Flag = { start: number; end: number; word: string; suggestions: string[] };
/** The check endpoint's answer (D-020). */
export type CheckAnswer = { v: 1; flagged: Flag[] };
/** A response exactly as it came back. Header names are lower-case. */
export type RawResponse = { status: number; headers: Record<string, string>; body: string };

/**
 * The raw form of the API door: sends one HTTP request to the product over the network and returns
 * status, headers and body untouched — for rows about refusals, limits, headers and malformed
 * requests. `body` as a string is sent byte for byte; any other value is sent as JSON. When `path` is
 * the check endpoint (the default, with method POST) it takes a check slot first, unless
 * `pace: false` (inside `holdCheckBudget`). It never retries, never follows a redirect, never parses,
 * and never throws on a status; it throws only when no response arrives (60 s).
 */
export async function sendRaw(opts: {
  method?: string;
  path?: string;
  body?: unknown;
  headers?: Record<string, string>;
  pace?: boolean;
} = {}): Promise<RawResponse> {
  const method = (opts.method ?? 'POST').toUpperCase();
  const path = opts.path ?? CHECK_PATH;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) {
    if (typeof opts.body === 'string') body = opts.body;
    else {
      body = JSON.stringify(opts.body);
      if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
    }
  }
  if (method === 'POST' && path === CHECK_PATH) await takeCheckSlot({ wait: opts.pace ?? true });
  const res = await fetch(PRODUCT_URL + path, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  });
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return { status: res.status, headers: out, body: await res.text() };
}

/**
 * The API door: checks `text` as the page does — POST /api/check with JSON {"text": text} — and
 * returns the parsed answer. Throws, failing the test with the status and body, when the product
 * answers anything but 200 with the D-020 shape ({"v": 1, "flagged": [{start, end, word,
 * suggestions}]}). It paces itself on the shared check budget. It never alters the text, never sorts
 * or filters the flags, and never checks them against the text: that is the test's to assert.
 */
export async function checkText(text: string): Promise<CheckAnswer> {
  const res = await sendRaw({ body: { text } });
  if (res.status !== 200) {
    throw new Error(`the check endpoint answered ${res.status} to a ${text.length}-character text: ${res.body.slice(0, 300)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error(`the check endpoint's 200 answer is not JSON: ${res.body.slice(0, 300)}`);
  }
  const a = parsed as Partial<CheckAnswer>;
  const shapeOk =
    a !== null &&
    typeof a === 'object' &&
    a.v === 1 &&
    Array.isArray(a.flagged) &&
    a.flagged.every(
      (f) =>
        f !== null &&
        typeof f === 'object' &&
        Number.isInteger(f.start) &&
        Number.isInteger(f.end) &&
        typeof f.word === 'string' &&
        Array.isArray(f.suggestions) &&
        f.suggestions.every((s) => typeof s === 'string'),
    );
  if (!shapeOk) throw new Error(`the check endpoint's answer is not the D-020 shape: ${res.body.slice(0, 300)}`);
  return a as CheckAnswer;
}

/** Where a word stands: `start`/`end` as UTF-16 offsets into the text (end exclusive), as D-020 says. */
export type Placed = { start: number; end: number; word: string };

/**
 * Builds a text from tokens joined by separators, returning the text and where each token stands —
 * the test's own record of positions, computed before anything is sent, so expected offsets never
 * come from the product. `separators[i]` goes between token i and i+1 (default one space).
 */
export function compose(tokens: readonly string[], separators?: readonly string[]): { text: string; placed: Placed[] } {
  let text = '';
  const placed: Placed[] = [];
  tokens.forEach((word, i) => {
    if (i > 0) text += separators?.[i - 1] ?? ' ';
    placed.push({ start: text.length, end: text.length + word.length, word });
    text += word;
  });
  return { text, placed };
}

/** A flag reduced to where it stands, for comparing with `Placed` (suggestions dropped). */
export function placeOf(f: { start: number; end: number; word: string }): Placed {
  return { start: f.start, end: f.end, word: f.word };
}

/** Sorts placements by start, then end — for exact comparison of whole lists. */
export function byPosition<T extends { start: number; end: number }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => x.start - y.start || x.end - y.end);
}

// ─── Engine door (Playwright's `page` is the engine; D-021 identifiers) ──────────────────────────

/**
 * The page's element identifiers (D-021) the doors select by, plus `flag`: each highlighted word is an
 * element carrying data-element="flag" whose own text is exactly the flagged word, inside an element
 * whose text is the offer's text (the box itself, or the copy of the text the highlights are drawn
 * on). The harness reads highlights by that identifier and nothing else — never by class, tag or
 * visible wording.
 */
export const ROLES = {
  checker: 'checker',
  offer: 'offer',
  notice: 'notice',
  check: 'check',
  copy: 'copy',
  count: 'count',
  message: 'message',
  footer: 'footer',
  privacyLink: 'privacy-link',
  privacyNote: 'privacy-note',
  back: 'back',
  flag: 'flag',
} as const;

/** The element(s) carrying data-element="<role>" on the page. Never falls back to any other selector. */
export function el(page: Page, role: string): Locator {
  return page.locator(`[data-element="${role}"]`);
}

/**
 * Opens the checker page (GET /) in the engine and waits until its text box and its Revisar ortografía
 * button are visible (15 s), failing by name when either is missing. It never fills, clicks or stores
 * anything.
 */
export async function openChecker(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'load' });
  await expect(el(page, ROLES.offer), 'the checker page shows its text box (data-element="offer")').toBeVisible({ timeout: DEFAULT_WAIT_MS });
  await expect(el(page, ROLES.check), 'the checker page shows its check button (data-element="check")').toBeVisible({ timeout: DEFAULT_WAIT_MS });
}

/**
 * Puts `text` in the offer box as the writer's input, through the box itself (Playwright `fill`: one
 * input, the way a paste lands; not the clipboard — a row about the clipboard path uses the clipboard
 * itself). Replaces whatever the box held. It never presses Check.
 */
export async function enterOffer(page: Page, text: string): Promise<void> {
  await el(page, ROLES.offer).first().fill(text, { timeout: DEFAULT_WAIT_MS });
}

/**
 * Presses the check button (data-element="check") the way the device does — a tap on a touch device,
 * a click otherwise — after taking a check slot, and waits for the page's own POST /api/check to be
 * answered (30 s; failing by name when the page sends none). Returns the answer's status. It never
 * waits for the page to finish drawing: assert what the writer sees with polling (`expect.poll`), on
 * the right element, after this returns.
 */
export async function pressCheck(page: Page): Promise<{ status: number }> {
  await takeCheckSlot();
  const answered = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === CHECK_PATH,
    { timeout: 30_000 },
  );
  const button = el(page, ROLES.check).first();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await button.tap({ timeout: DEFAULT_WAIT_MS });
  else await button.click({ timeout: DEFAULT_WAIT_MS });
  let res;
  try {
    res = await answered;
  } catch {
    throw new Error('pressing the check button sent no POST /api/check within 30 s');
  }
  return { status: res.status() };
}

/** A highlight as the writer sees it on the page. */
export type Highlight = {
  /** The highlighted element's own text. */
  word: string;
  /** Its UTF-16 offset in the offer's text; -1 when it stands in no copy of the text. */
  start: number;
  /** start + word.length; -1 with start. */
  end: number;
  /** It has a box on screen and is not hidden or fully transparent. */
  visible: boolean;
  /** It is drawn differently from the text around it: a background, an underline, a border, an
   *  outline, a shadow or a text colour of its own. */
  marked: boolean;
};

/**
 * Reads every highlight on the page (data-element="flag"), sorted by position. A highlight's position
 * is its offset inside the nearest enclosing element whose text equals `text` (trailing whitespace or
 * zero-width characters aside; or equals `text` with its line breaks removed, for a box that draws
 * breaks as elements — positions are then mapped back to `text`). A highlight in no such element has
 * start -1. One evaluation, no navigation, no waiting: poll it (`expect.poll`) after `pressCheck`.
 * It never clicks a highlight and never reads the check endpoint's answer.
 */
export async function readHighlights(page: Page, text: string): Promise<Highlight[]> {
  const found = await page.evaluate((t: string) => {
    const trimEnd = (s: string) => s.replace(/[\s​﻿]+$/u, '');
    const noBreaks = t.replace(/\r\n|\r|\n/g, '');
    // position in noBreaks → position in t
    const back: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] !== '\n' && t[i] !== '\r') back.push(i);
    back.push(t.length);
    const transparent = (c: string) => c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
    return Array.from(document.querySelectorAll('[data-element="flag"]')).map((node) => {
      const f = node as HTMLElement;
      const word = f.textContent ?? '';
      let anc: HTMLElement | null = f.parentElement;
      let mode: 'exact' | 'nobreaks' | null = null;
      while (anc) {
        const tc = anc.textContent ?? '';
        if (tc === t || trimEnd(tc) === trimEnd(t)) { mode = 'exact'; break; }
        if (noBreaks !== t && (tc === noBreaks || trimEnd(tc) === trimEnd(noBreaks))) { mode = 'nobreaks'; break; }
        anc = anc.parentElement;
      }
      let start = -1;
      if (anc && mode) {
        const walker = document.createTreeWalker(anc, NodeFilter.SHOW_TEXT);
        let off = 0;
        let n: Node | null;
        let reached = false;
        while ((n = walker.nextNode())) {
          if (f.contains(n)) { reached = true; break; }
          off += (n as Text).data.length;
        }
        if (reached || word === '') start = mode === 'exact' ? off : back[off] ?? -1;
      }
      const cs = getComputedStyle(f);
      const ca = getComputedStyle(anc ?? f.parentElement ?? f);
      const r = f.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
      const marked =
        (!transparent(cs.backgroundColor) && cs.backgroundColor !== ca.backgroundColor) ||
        cs.backgroundImage !== 'none' ||
        /underline|overline|line-through/.test(cs.textDecorationLine) ||
        (cs.borderBottomStyle !== 'none' && parseFloat(cs.borderBottomWidth) > 0) ||
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
        cs.boxShadow !== 'none' ||
        (!transparent(cs.color) && cs.color !== ca.color);
      return { word, start, end: start < 0 ? -1 : start + word.length, visible, marked };
    });
  }, text);
  return byPosition(found);
}

// ─── Operator door (D-024: the Docker engine's socket, as an operator on the server) ────────────

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
    req.on('error', (e) => reject(new Error(`setup: the operator door cannot reach the Docker engine at ${DOCKER_SOCKET} (${e.message})`)));
    if (payload) req.write(payload);
    req.end();
  });
}

// Docker's multiplexed stream: 8-byte frames [stream, 0, 0, 0, size(4, big-endian)] + payload.
function demux(buf: Buffer): { stdout: string; stderr: string } {
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const kind = buf[i];
    const size = buf.readUInt32BE(i + 4);
    if (kind > 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0 || i + 8 + size > buf.length) {
      return { stdout: buf.toString('utf8'), stderr: '' }; // not multiplexed (a TTY container)
    }
    (kind === 2 ? err : out).push(buf.subarray(i + 8, i + 8 + size));
    i += 8 + size;
  }
  return { stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') };
}

let productId: string | undefined;

/**
 * Finds the product's container the way D-024 says: the container sharing this tests container's
 * compose project label whose service label is VID_PRODUCT_SERVICE (`product`). Fails `setup:` when
 * the socket, the own container or the product container is missing. Read-only: never starts, stops
 * or changes a container.
 */
export async function productContainer(): Promise<{ id: string }> {
  if (productId) return { id: productId };
  const service = process.env.VID_PRODUCT_SERVICE ?? 'product';
  const own = await docker('GET', `/containers/${encodeURIComponent(hostname())}/json`);
  if (own.status !== 200) throw new Error(`setup: the operator door cannot inspect its own container ${hostname()} (status ${own.status})`);
  const project = (JSON.parse(own.body.toString('utf8')) as { Config?: { Labels?: Record<string, string> } }).Config?.Labels?.['com.docker.compose.project'];
  if (!project) throw new Error('setup: the tests container carries no com.docker.compose.project label');
  const filters = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${project}`, `com.docker.compose.service=${service}`] }));
  const list = await docker('GET', `/containers/json?filters=${filters}`);
  const found = JSON.parse(list.body.toString('utf8')) as { Id: string }[];
  if (list.status !== 200 || found.length !== 1) {
    throw new Error(`setup: expected one running "${service}" container in compose project ${project}, found ${Array.isArray(found) ? found.length : 'none'}`);
  }
  productId = found[0].Id;
  return { id: productId };
}

/**
 * The operator door's log reader: everything the product process has written to stdout and stderr
 * (the container's log, as `docker logs` shows it), optionally only since `sinceUnixSeconds`. Returns
 * the text, stdout and stderr joined. It never filters, parses or truncates what the product wrote.
 */
export async function productLogs(opts: { sinceUnixSeconds?: number } = {}): Promise<string> {
  const { id } = await productContainer();
  const since = opts.sinceUnixSeconds ? `&since=${Math.floor(opts.sinceUnixSeconds)}` : '';
  const res = await docker('GET', `/containers/${id}/logs?stdout=true&stderr=true&timestamps=false${since}`);
  if (res.status !== 200) throw new Error(`setup: the product container's log could not be read (status ${res.status})`);
  const { stdout, stderr } = demux(res.body);
  return stdout + stderr;
}

// Runs inside the product container with its own node: walks the file tree from the given roots
// (skipping /proc, /sys and /dev, which are the kernel's, not files), reads every regular file in
// 1 MiB chunks and reports the files whose bytes contain the needle's UTF-8 bytes.
const SEARCH_SCRIPT = `
const fs = require('fs');
const needle = Buffer.from(process.argv[1], 'utf8');
const roots = process.argv.slice(2);
const skip = new Set(['/proc', '/sys', '/dev']);
const out = { matches: [], filesScanned: 0, bytesScanned: 0, unreadable: [] };
const stack = [...roots];
const buf = Buffer.alloc(1 << 20);
while (stack.length) {
  const p = stack.pop();
  if (skip.has(p)) continue;
  let st;
  try { st = fs.lstatSync(p); } catch (e) { out.unreadable.push(p); continue; }
  if (st.isDirectory()) {
    let names;
    try { names = fs.readdirSync(p); } catch (e) { out.unreadable.push(p); continue; }
    for (const n of names) stack.push(p === '/' ? '/' + n : p + '/' + n);
    continue;
  }
  if (!st.isFile()) continue;
  let fd;
  try { fd = fs.openSync(p, 'r'); } catch (e) { out.unreadable.push(p); continue; }
  try {
    let carry = Buffer.alloc(0), hit = false, n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      out.bytesScanned += n;
      const chunk = Buffer.concat([carry, buf.subarray(0, n)]);
      if (chunk.indexOf(needle) !== -1) { hit = true; break; }
      carry = chunk.subarray(Math.max(0, chunk.length - needle.length + 1));
    }
    out.filesScanned++;
    if (hit) out.matches.push(p);
  } catch (e) { out.unreadable.push(p); } finally { fs.closeSync(fd); }
}
process.stdout.write(JSON.stringify(out));
`;

export type FileSearch = { matches: string[]; filesScanned: number; bytesScanned: number; unreadable: string[] };

/**
 * The operator door's file search: as root inside the product's container, reads every regular file
 * under `roots` (default the whole tree, `/`, minus /proc, /sys and /dev) and returns the paths whose
 * bytes contain `needle` (UTF-8), with how many files and bytes it read and which it could not.
 * Fails `setup:` when it read no file at all (an empty search proves nothing). Use an ASCII needle
 * (`freshMarker()`) so no escaping hides it. It never decompresses, never follows symbolic links,
 * never searches another container or a volume not mounted in the product's container, and never
 * writes or deletes anything.
 */
export async function searchProductFiles(needle: string, opts: { roots?: string[] } = {}): Promise<FileSearch> {
  if (needle.length === 0) throw new Error('setup: searchProductFiles needs a non-empty needle');
  const { id } = await productContainer();
  const created = await docker('POST', `/containers/${id}/exec`, {
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: '0',
    Cmd: ['node', '-e', SEARCH_SCRIPT, needle, ...(opts.roots ?? ['/'])],
  });
  if (created.status !== 201) throw new Error(`setup: the product container refused an exec (status ${created.status}): ${created.body.toString('utf8').slice(0, 200)}`);
  const execId = (JSON.parse(created.body.toString('utf8')) as { Id: string }).Id;
  const started = await docker('POST', `/exec/${execId}/start`, { Detach: false, Tty: false }, 300_000);
  const { stdout, stderr } = demux(started.body);
  const inspected = await docker('GET', `/exec/${execId}/json`);
  const exitCode = (JSON.parse(inspected.body.toString('utf8')) as { ExitCode: number | null }).ExitCode;
  if (exitCode !== 0) throw new Error(`setup: the file search in the product container exited ${exitCode}: ${stderr.slice(0, 300)}`);
  let result: FileSearch;
  try {
    result = JSON.parse(stdout) as FileSearch;
  } catch {
    throw new Error(`setup: the file search's report is unreadable: ${stdout.slice(0, 200)}`);
  }
  if (result.filesScanned === 0) throw new Error('setup: the file search read no file — an empty search proves nothing');
  return result;
}
