// Purpose: the privacy-text batch's helpers beside the harness client — the marker offer (three planted forms),
// the forms each marker is searched in (plain, case, escaped, base64), the operator door widened to every
// harness service but the tests runner (files with decompression, logs, a network-counter monitor, a heap
// snapshot), and the browser-side readers (requests sent, storage, Cache Storage) the privacy rows assert on.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-text) from REQ-017, REQ-018,
// A-008 and D-023/D-024; nothing here is produced by, imported from, or read out of the product's source.
//
// Contract: every export is a public helper for the privacy-text tests; what a docstring says a function never
// does, it never does. Like the harness's operator door, the Docker-socket functions here read; the two that
// act inside the product's container (`networkMonitor`, `heapSnapshotSearch`) say exactly what they do there.

import { request as httpRequest } from 'node:http';
import { hostname } from 'node:os';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { constants as zc, gunzipSync } from 'node:zlib';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import {
  accentPopulation,
  CHECK_PATH,
  compose,
  el,
  fillerWords,
  hasInclusiveReading,
  isDictionaryWord,
  productContainer,
  ROLES,
  takeCheckSlot,
  type Placed,
  type Rng,
} from './harness';

// ─── The marker offer ────────────────────────────────────────────────────────────────────────────

/** An offer carrying three fresh markers (REQ-018's "unique marker string", planted in three forms). */
export type MarkerOffer = {
  /** The whole offer, under 400 characters, every marker in its first 300. */
  text: string;
  /** A digit-free unknown word — lower case, no vowel, no x — that the checker flags (REQ-001). */
  unknown: Placed;
  /** A title-case pseudo-name written mid-sentence — not flagged (A-012 proper nouns; A-036 does not apply). */
  name: Placed;
  /** A phrase of five correct, accented dictionary words — nothing in it is flagged. */
  phrase: Placed;
  /** An ordinary accent misspelling (an accented dictionary word with its accent dropped), flagged. */
  misspelled: Placed;
  /** The accented dictionary word `misspelled` stands for. */
  correction: string;
  /** Exactly the flags a right product returns for `text`, by position: `misspelled` and `unknown`. */
  flagged: Placed[];
};

const CONSONANTS = 'bcdfghjklmnprstvz'; // no x (inclusive readings), no q, w or y
const VOWELS = 'aeiou';

function accentVariants(word: string): string[] {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
  const out: string[] = [];
  for (let i = 0; i < word.length; i++) if (map[word[i]]) out.push(word.slice(0, i) + map[word[i]] + word.slice(i + 1));
  return out;
}

/**
 * Builds a fresh marker offer from `rng`: the unknown word `zvid` + 14 random consonants; the pseudo-name a
 * capital consonant-vowel run of 14 letters (no dictionary word, no inclusive reading, no accent-restored
 * dictionary form); the phrase five random accented dictionary words of the accent population; the
 * misspelling another population word with its accents stripped. All between correct filler words, the
 * name never first in its sentence. Every planted value is checked against the dictionary oracle; `setup:`
 * when one is not what it must be. Positions are the test's own record, never the product's.
 */
export function markerOffer(rng: Rng): MarkerOffer {
  let unknown = 'zvid';
  for (let i = 0; i < 14; i++) unknown += CONSONANTS[rng.int(CONSONANTS.length)];
  if (isDictionaryWord(unknown) || hasInclusiveReading(unknown)) throw new Error(`setup: the unknown marker ${unknown} is a dictionary word or an inclusive form`);

  let name = '';
  for (let tries = 0; ; tries++) {
    let n = '';
    for (let i = 0; i < 7; i++) n += CONSONANTS[rng.int(CONSONANTS.length)] + VOWELS[rng.int(VOWELS.length)];
    const ok = !isDictionaryWord(n) && !hasInclusiveReading(n) && !accentVariants(n).some((v) => isDictionaryWord(v));
    if (ok) {
      name = n[0].toUpperCase() + n.slice(1);
      break;
    }
    if (tries > 50) throw new Error('setup: no fresh pseudo-name could be drawn');
  }

  const population = accentPopulation().filter((p) => p.word.length <= 12 && isDictionaryWord(p.word));
  if (population.length < 1_000) throw new Error('setup: the accent population is too small to draw a marker phrase from');
  const picked = rng.shuffle(population).slice(0, 6);
  const phraseWords = picked.slice(0, 5).map((p) => p.word);
  const miss = picked[5];
  if (isDictionaryWord(miss.stripped)) throw new Error(`setup: ${miss.stripped} is a dictionary word`);

  const head = ['Buscamos', 'persona', 'para', 'el', 'equipo', 'de'];
  const tokens = [...head, name, 'con', 'experiencia', 'en', ...phraseWords, miss.stripped, 'y', unknown, 'para', rng.pick(['proyectos', 'clientes', 'tareas'])];
  const phraseEnd = head.length + 1 + 3 + phraseWords.length - 1; // index of the phrase's last word
  const separators = tokens.slice(1).map((_, i) => (i === phraseEnd ? ', ' : ' '));
  const { text: body, placed } = compose(tokens, separators);
  const text = body + '.';
  const at = (w: string) => {
    const p = placed.find((x) => x.word === w);
    if (!p) throw new Error(`setup: ${w} is not placed`);
    return p;
  };
  const first = at(phraseWords[0]);
  const last = at(phraseWords[phraseWords.length - 1]);
  const phrase: Placed = { start: first.start, end: last.end, word: text.slice(first.start, last.end) };
  if (phrase.word !== phraseWords.join(' ')) throw new Error('setup: the marker phrase is not one run of words');
  const offer: MarkerOffer = {
    text,
    unknown: at(unknown),
    name: at(name),
    phrase,
    misspelled: at(miss.stripped),
    correction: miss.word,
    flagged: [at(miss.stripped), at(unknown)].sort((a, b) => a.start - b.start),
  };
  for (const p of [offer.unknown, offer.name, offer.phrase]) {
    if (text.slice(p.start, p.end) !== p.word || p.end > 300) throw new Error('setup: a marker is not where the offer says');
  }
  return offer;
}

/**
 * The marker offer padded with correct filler words to exactly `length` characters (default 10,001, one
 * over REQ-021's limit), the markers kept at the start. No trailing whitespace; `setup:` when the length
 * cannot be met exactly.
 */
export function oversizeMarkerText(offer: MarkerOffer, rng: Rng, length = 10_001): string {
  const fillers = fillerWords();
  let text = offer.text;
  while (length - text.length > 25) text += ' ' + rng.pick(fillers); // each step adds at most 12, leaving 14 to 25
  // finish with one or two words whose lengths make the total exact
  const r = length - text.length;
  const byLen = new Map<number, string>();
  for (const w of fillers) if (!byLen.has(w.length)) byLen.set(w.length, w);
  if (byLen.has(r - 1)) text += ' ' + byLen.get(r - 1);
  else {
    let done = false;
    for (const [a, wa] of byLen) {
      const b = r - 2 - a;
      if (byLen.has(b)) {
        text += ' ' + wa + ' ' + byLen.get(b);
        done = true;
        break;
      }
    }
    if (!done) {
      for (const [a, wa] of byLen) {
        for (const [b, wb] of byLen) {
          const c = r - 3 - a - b;
          if (!done && byLen.has(c)) {
            text += ' ' + wa + ' ' + wb + ' ' + byLen.get(c);
            done = true;
          }
        }
      }
    }
  }
  if (text.length !== length) throw new Error(`setup: the oversize text is ${text.length} characters, not ${length}`);
  return text;
}

/**
 * Takes one check slot like the harness's takeCheckSlot, but when the shared budget stays full past the
 * harness's bound (another test holding it for a limit row), tries again — at most three times — before the
 * `setup:` failure stands. For a case whose window must not open until its check can be sent at once.
 */
export async function takeCheckSlotPatiently(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await takeCheckSlot();
      return;
    } catch (e) {
      if (attempt >= 3 || !String((e as Error).message).startsWith('setup: no check slot')) throw e;
    }
  }
}

// ─── The forms a marker is searched in ───────────────────────────────────────────────────────────

/** One string to search for, and which marker and form it is. */
export type Needle = { form: string; value: string };

function jsonEscape(s: string, upper: boolean): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out += ch;
    else {
      for (const unit of ch.split('')) {
        const h = unit.charCodeAt(0).toString(16).padStart(4, '0');
        out += '\\u' + (upper ? h.toUpperCase() : h);
      }
    }
  }
  return out;
}

/**
 * The base64 slices that must appear in ANY base64 encoding of a byte stream holding `s` (UTF-8): one per
 * alignment (the marker at byte offset 0, 1 or 2 modulo 3), each cut to the characters made only of the
 * marker's own bits. Standard alphabet; `base64url` adds the URL-safe one.
 */
export function base64Slices(s: string): string[] {
  const bytes = Buffer.from(s, 'utf8');
  const out: string[] = [];
  for (let k = 0; k < 3; k++) {
    const enc = Buffer.concat([Buffer.alloc(k), bytes]).toString('base64');
    out.push(enc.slice(Math.ceil((k * 8) / 6), Math.floor(((k + bytes.length) * 8) / 6)));
  }
  return out;
}

/**
 * Every form the three markers of `offer` are searched in: as written; lower and upper case; Unicode NFD;
 * JSON-escaped (\uXXXX, lower and upper hex); percent-encoded (encodeURIComponent, and form encoding with
 * `+`); HTML numeric entities; and base64 (standard and URL-safe, every alignment) of the plain and
 * lower-case forms. Deduplicated. Self-checks its base64 slices against real encodings at random offsets
 * (`setup:` on a miss). It never includes a form shorter than 12 characters.
 */
export function needleForms(offer: MarkerOffer, rng: Rng): Needle[] {
  const out = new Map<string, string>();
  const add = (form: string, value: string) => {
    if (value.length >= 12 && !out.has(value)) out.set(value, form);
  };
  const markers: [string, string][] = [
    ['unknown', offer.unknown.word],
    ['name', offer.name.word],
    ['phrase', offer.phrase.word],
  ];
  for (const [label, m] of markers) {
    add(`${label}`, m);
    add(`${label} lower-case`, m.toLowerCase());
    add(`${label} upper-case`, m.toUpperCase());
    add(`${label} NFD`, m.normalize('NFD'));
    add(`${label} JSON-escaped`, jsonEscape(m, false));
    add(`${label} JSON-escaped (upper hex)`, jsonEscape(m, true));
    add(`${label} JSON-escaped lower-case`, jsonEscape(m.toLowerCase(), false));
    add(`${label} percent-encoded`, encodeURIComponent(m));
    add(`${label} percent-encoded lower-case`, encodeURIComponent(m.toLowerCase()));
    add(`${label} form-encoded`, encodeURIComponent(m).replace(/%20/g, '+'));
    add(`${label} HTML entities`, [...m].map((ch) => (ch.codePointAt(0)! < 0x80 ? ch : `&#${ch.codePointAt(0)};`)).join(''));
    add(`${label} HTML hex entities`, [...m].map((ch) => (ch.codePointAt(0)! < 0x80 ? ch : `&#x${ch.codePointAt(0)!.toString(16)};`)).join(''));
    for (const [variant, v] of [['', m], [' lower-case', m.toLowerCase()]] as const) {
      base64Slices(v).forEach((slice, k) => {
        add(`${label}${variant} base64 (alignment ${k})`, slice);
        add(`${label}${variant} base64url (alignment ${k})`, slice.replace(/\+/g, '-').replace(/\//g, '_'));
      });
    }
  }
  // self-check: each marker, inside random bytes at a random offset, is found by one of its slices
  for (const [, m] of markers) {
    for (let k = 0; k < 3; k++) {
      const prefix = Buffer.from(Array.from({ length: 5 + k + 3 * rng.int(4) }, () => rng.int(256)));
      const enc = Buffer.concat([prefix, Buffer.from(m, 'utf8'), Buffer.from([rng.int(256), rng.int(256)])]).toString('base64');
      if (!base64Slices(m).some((s) => enc.includes(s))) throw new Error('setup: the base64 slices do not find a marker in a real encoding');
    }
  }
  return [...out].map(([value, form]) => ({ form, value }));
}

/** The needles of `needles` found in `haystack` (string search; the forms already cover case). */
export function foundIn(haystack: string, needles: readonly Needle[]): string[] {
  return needles.filter((n) => haystack.includes(n.value)).map((n) => n.form);
}

// ─── The operator door, widened: every harness service but the tests runner (D-024) ──────────────

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

/** A harness service container other than the tests runner. */
export type ServiceContainer = { id: string; service: string; hostname: string; cmd: string[] };

/**
 * Every running container of this harness's compose project except the tests runner itself: the product
 * today, and any service the harness adds later (the proxy, D-025) without a change here. `setup:` when the
 * product (the harness's productContainer) is not among them. Read-only.
 */
export async function serviceContainers(): Promise<ServiceContainer[]> {
  const product = await productContainer();
  const own = await docker('GET', `/containers/${encodeURIComponent(hostname())}/json`);
  if (own.status !== 200) throw new Error(`setup: the operator door cannot inspect its own container (status ${own.status})`);
  const ownInfo = JSON.parse(own.body.toString('utf8')) as { Id: string; Config?: { Labels?: Record<string, string> } };
  const project = ownInfo.Config?.Labels?.['com.docker.compose.project'];
  if (!project) throw new Error('setup: the tests container carries no compose project label');
  const filters = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${project}`] }));
  const list = await docker('GET', `/containers/json?filters=${filters}`);
  const found = JSON.parse(list.body.toString('utf8')) as { Id: string; Labels?: Record<string, string> }[];
  const out: ServiceContainer[] = [];
  for (const c of found) {
    if (c.Id === ownInfo.Id) continue;
    const ins = await docker('GET', `/containers/${c.Id}/json`);
    const info = JSON.parse(ins.body.toString('utf8')) as { Config?: { Hostname?: string; Cmd?: string[] } };
    out.push({ id: c.Id, service: c.Labels?.['com.docker.compose.service'] ?? '?', hostname: info.Config?.Hostname ?? '', cmd: info.Config?.Cmd ?? [] });
  }
  if (!out.some((c) => c.id === product.id)) throw new Error('setup: the product container is not among the harness services');
  return out;
}

type ExecResult = { stdout: string; stderr: string; exitCode: number | null };

/**
 * Runs `cmd` inside container `id` as root and returns its output and exit code. With `onOutput`, the
 * caller sees the raw output as it arrives (for a monitor that announces it is ready).
 */
async function execIn(id: string, cmd: string[], timeoutMs = 300_000, onOutput?: (soFar: string) => void): Promise<ExecResult> {
  const created = await docker('POST', `/containers/${id}/exec`, { AttachStdout: true, AttachStderr: true, Tty: false, User: '0', Cmd: cmd });
  if (created.status !== 201) throw new Error(`setup: container ${id.slice(0, 12)} refused an exec (status ${created.status}): ${created.body.toString('utf8').slice(0, 200)}`);
  const execId = (JSON.parse(created.body.toString('utf8')) as { Id: string }).Id;
  const raw: Buffer = await new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify({ Detach: false, Tty: false }));
    const req = httpRequest(
      { socketPath: DOCKER_SOCKET, method: 'POST', path: `/exec/${execId}/start`, headers: { 'content-type': 'application/json', 'content-length': payload.length }, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          chunks.push(c);
          if (onOutput) onOutput(Buffer.concat(chunks).toString('latin1'));
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`setup: an exec in container ${id.slice(0, 12)} gave no output for ${timeoutMs / 1000} s`)));
    req.on('error', (e) => reject(new Error(`setup: the exec stream failed (${e.message})`)));
    req.write(payload);
    req.end();
  });
  const { stdout, stderr } = demux(raw);
  const inspected = await docker('GET', `/exec/${execId}/json`);
  const exitCode = (JSON.parse(inspected.body.toString('utf8')) as { ExitCode: number | null }).ExitCode;
  return { stdout, stderr, exitCode };
}

const b64json = (v: unknown) => Buffer.from(JSON.stringify(v), 'utf8').toString('base64');

// Runs inside a service container with its own node: walks every file from / (skipping the kernel's /proc,
// /sys and /dev), searches each one's bytes for every needle, and — for gzip data (by magic number), .br and
// .zst files — the decompressed bytes too; reports compressed files of other kinds changed since `since`
// (it cannot read them), and where it found the container's own hostname (the search's control: /etc/hostname).
// It first proves its own decompression path on a gzip it makes in memory. It writes nothing.
const FILE_SEARCH_SCRIPT = `
const fs = require('fs'); const zlib = require('zlib');
const spec = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
const needles = spec.needles.map(n => ({ form: n.form, buf: Buffer.from(n.value, 'utf8') }));
const control = Buffer.from(spec.control, 'utf8');
const maxLen = Math.max(control.length, ...needles.map(n => n.buf.length));
const skip = new Set(['/proc', '/sys', '/dev']);
const out = { matches: [], controlFoundIn: [], filesScanned: 0, bytesScanned: 0, decompressed: 0, unreadable: [], undecodedRecent: [] };
function scan(buf, path, via) {
  for (const n of needles) if (buf.indexOf(n.buf) !== -1) out.matches.push({ path, form: n.form, via });
  if (via === 'raw' && buf.indexOf(control) !== -1) out.controlFoundIn.push(path);
}
function decompressed(path, head) {
  try {
    if (head[0] === 0x1f && head[1] === 0x8b) return zlib.gunzipSync(fs.readFileSync(path), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    if (/\\.br$/.test(path)) return zlib.brotliDecompressSync(fs.readFileSync(path));
    if (/\\.zst$/.test(path) && zlib.zstdDecompressSync) return zlib.zstdDecompressSync(fs.readFileSync(path));
  } catch (e) { return null; }
  return undefined;
}
{ // self-test of the decompression path
  const probe = 'vid-selftest-' + Date.now();
  const gz = zlib.gzipSync(Buffer.from('xx' + probe + 'yy'));
  const back = zlib.gunzipSync(gz, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
  if (back.indexOf(Buffer.from(probe)) === -1) { process.stderr.write('decompression self-test failed'); process.exit(3); }
}
const stack = ['/'];
const chunk = Buffer.alloc(1 << 20);
while (stack.length) {
  const p = stack.pop();
  if (skip.has(p)) continue;
  let st;
  try { st = fs.lstatSync(p); } catch (e) { out.unreadable.push(p); continue; }
  if (st.isDirectory()) {
    let names; try { names = fs.readdirSync(p); } catch (e) { out.unreadable.push(p); continue; }
    for (const n of names) stack.push(p === '/' ? '/' + n : p + '/' + n);
    continue;
  }
  if (!st.isFile()) continue;
  let fd; try { fd = fs.openSync(p, 'r'); } catch (e) { out.unreadable.push(p); continue; }
  let head = Buffer.alloc(0);
  try {
    let carry = Buffer.alloc(0), n;
    while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      out.bytesScanned += n;
      if (head.length === 0) head = Buffer.from(chunk.subarray(0, Math.min(n, 4)));
      const buf = Buffer.concat([carry, chunk.subarray(0, n)]);
      scan(buf, p, 'raw');
      carry = Buffer.from(buf.subarray(Math.max(0, buf.length - maxLen + 1)));
    }
    out.filesScanned++;
  } catch (e) { out.unreadable.push(p); } finally { fs.closeSync(fd); }
  const looksCompressed = (head[0] === 0x1f && head[1] === 0x8b) || /\\.(gz|br|zst|bz2|xz|lz4|lzma|z|zip|7z)$/i.test(p);
  if (!looksCompressed) continue;
  const d = st.size <= (64 << 20) ? decompressed(p, head) : null;
  if (d) { out.decompressed++; scan(d, p, 'decompressed'); }
  else if (st.mtimeMs >= spec.since) out.undecodedRecent.push(p);
}
// dedupe the matches (a needle found in two chunks of one file is one finding)
const seen = new Set(); out.matches = out.matches.filter(m => { const k = m.path + '|' + m.form + '|' + m.via; if (seen.has(k)) return false; seen.add(k); return true; });
out.controlFoundIn = [...new Set(out.controlFoundIn)];
process.stdout.write(JSON.stringify(out));
`;

/** One container's file search. */
export type ContainerFileSearch = {
  service: string;
  matches: { path: string; form: string; via: 'raw' | 'decompressed' }[];
  /** Where the container's own hostname was found — the search's control (/etc/hostname holds it). */
  controlFoundIn: string[];
  filesScanned: number;
  bytesScanned: number;
  decompressed: number;
  unreadable: string[];
  /** Compressed files changed since the scenario began that the search could not decompress. */
  undecodedRecent: string[];
};

/**
 * The operator's whole-disk search, in every harness service container but the tests runner: every regular
 * file from / (minus /proc, /sys, /dev — the kernel's), the raw bytes and, for gzip, brotli and zstd data,
 * the decompressed bytes, for every needle; with the container's hostname as the control the search must
 * find. Needs `node` in the container (`setup:` naming the service otherwise — a service whose files this
 * cannot read is never reported clean). It never writes, deletes or changes anything.
 */
export async function searchServiceFiles(needles: readonly Needle[], sinceMs: number): Promise<ContainerFileSearch[]> {
  const results: ContainerFileSearch[] = [];
  for (const c of await serviceContainers()) {
    const spec = { needles, control: c.hostname, since: sinceMs };
    const r = await execIn(c.id, ['node', '-e', FILE_SEARCH_SCRIPT, b64json(spec)]);
    if (r.exitCode === 126 || r.exitCode === 127) throw new Error(`setup: the file search cannot run in service "${c.service}" (no node there: exit ${r.exitCode}); its files are unsearched, never clean`);
    if (r.exitCode !== 0) throw new Error(`setup: the file search in service "${c.service}" exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
    let parsed: Omit<ContainerFileSearch, 'service'>;
    try {
      parsed = JSON.parse(r.stdout);
    } catch {
      throw new Error(`setup: the file search's report from "${c.service}" is unreadable: ${r.stdout.slice(0, 200)}`);
    }
    if (parsed.filesScanned === 0) throw new Error(`setup: the file search in "${c.service}" read no file — an empty search proves nothing`);
    results.push({ service: c.service, ...parsed });
  }
  return results;
}

/**
 * Everything every harness service but the tests runner has written to stdout and stderr since it started
 * (its container log, as `docker logs` shows it — rotated files included, as the engine keeps them), per
 * service. It never filters or truncates.
 */
export async function serviceLogs(): Promise<{ service: string; text: string }[]> {
  const out: { service: string; text: string }[] = [];
  for (const c of await serviceContainers()) {
    const res = await docker('GET', `/containers/${c.id}/logs?stdout=true&stderr=true&timestamps=false`);
    if (res.status !== 200) throw new Error(`setup: the log of service "${c.service}" could not be read (status ${res.status})`);
    const { stdout, stderr } = demux(res.body);
    out.push({ service: c.service, text: stdout + stderr });
  }
  return out;
}

/**
 * Waits until the services' logs stop growing (unchanged across two reads 750 ms apart), at most 15 s, so a
 * line written asynchronously after a response is in the log before it is searched. Never fails on the bound:
 * a log that keeps growing (a request line per health check) is searched as it stands then.
 */
export async function settleLogs(): Promise<void> {
  const began = Date.now();
  let last = -1;
  let stable = 0;
  while (Date.now() - began < 15_000) {
    const size = (await serviceLogs()).reduce((n, l) => n + l.text.length, 0);
    stable = size === last ? stable + 1 : 0;
    if (stable >= 2) return;
    last = size;
    await new Promise((r) => setTimeout(r, 750));
  }
}

// ─── Inside the product's network namespace: the outbound-attempt monitor (ROW-033) ─────────────

// Reads the kernel's per-namespace counters (/proc/net/snmp, /proc/net/snmp6) — monotonic counts of UDP
// datagrams sent (every DNS query), IP packets with no route (every attempt to reach an outside address from
// a network with no route out), ICMP echoes — and, in "watch" mode, polls the socket tables for any socket
// whose far end is not loopback and whose near end is not a listening port of the product.
const NET_SCRIPT = `
const fs = require('fs'); const dns = require('dns'); const net = require('net');
const spec = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
function counters() {
  const c = {};
  const t = fs.readFileSync('/proc/net/snmp', 'utf8').trim().split('\\n');
  for (let i = 0; i + 1 < t.length; i += 2) {
    const ks = t[i].split(/\\s+/), vs = t[i + 1].split(/\\s+/);
    const p = ks[0].replace(':', '');
    for (let j = 1; j < ks.length; j++) c[p + '.' + ks[j]] = Number(vs[j]);
  }
  try { for (const l of fs.readFileSync('/proc/net/snmp6', 'utf8').trim().split('\\n')) { const [k, v] = l.split(/\\s+/); c['6.' + k] = Number(v); } } catch (e) {}
  return c;
}
function pick(c) {
  return {
    udpOut: (c['Udp.OutDatagrams'] || 0) + (c['UdpLite.OutDatagrams'] || 0) + (c['6.Udp6OutDatagrams'] || 0) + (c['6.UdpLite6OutDatagrams'] || 0),
    noRoute: (c['Ip.OutNoRoutes'] || 0) + (c['6.Ip6OutNoRoutes'] || 0),
    icmpEcho: (c['Icmp.OutEchos'] || 0) + (c['6.Icmp6OutEchos'] || 0),
    tcpActiveOpens: c['Tcp.ActiveOpens'] || 0,
  };
}
function delta(a, b) { const o = {}; for (const k of Object.keys(a)) o[k] = b[k] - a[k]; return o; }
function hexIp(h) {
  if (h.length === 8) return [3, 2, 1, 0].map(i => parseInt(h.substr(i * 2, 2), 16)).join('.');
  const words = []; for (let i = 0; i < 4; i++) { const w = h.substr(i * 8, 8); words.push(w.substr(6, 2) + w.substr(4, 2) + w.substr(2, 2) + w.substr(0, 2)); }
  const full = words.join(''); const parts = []; for (let i = 0; i < 32; i += 4) parts.push(full.substr(i, 4));
  return parts.join(':');
}
function loopback(ip) { return ip.startsWith('127.') || ip === '0000:0000:0000:0000:0000:0000:0000:0001' || /^0000:0000:0000:0000:0000:ffff:7f/i.test(ip); }
function zero(ip) { return ip === '0.0.0.0' || /^[0:]+$/.test(ip); }
function sockets() {
  const out = [];
  for (const f of ['tcp', 'tcp6', 'udp', 'udp6']) {
    let lines; try { lines = fs.readFileSync('/proc/net/' + f, 'utf8').trim().split('\\n').slice(1); } catch (e) { continue; }
    for (const l of lines) {
      const p = l.trim().split(/\\s+/);
      const [la, lp] = p[1].split(':'), [ra, rp] = p[2].split(':');
      const local = hexIp(la), remote = hexIp(ra), lport = parseInt(lp, 16), rport = parseInt(rp, 16);
      if (zero(remote) || loopback(remote)) continue;
      if (spec.ports.includes(lport)) continue;
      out.push(f + ' ' + local + ':' + lport + ' -> ' + remote + ':' + rport + ' state ' + p[3]);
    }
  }
  return out;
}
(async () => {
  if (spec.mode === 'control') {
    const c0 = pick(counters());
    const lookup = await new Promise(r => dns.lookup(spec.probeName, e => r(e ? e.code : 'resolved')));
    const conn = await new Promise(r => { const s = net.connect({ host: spec.probeIp, port: 9 }); const t = setTimeout(() => { s.destroy(); r('timeout'); }, 3000); s.on('error', e => { clearTimeout(t); r(e.code); }); s.on('connect', () => { clearTimeout(t); s.destroy(); r('connected'); }); });
    const c1 = pick(counters());
    process.stdout.write(JSON.stringify({ delta: delta(c0, c1), lookup, conn }));
    return;
  }
  const c0 = pick(counters());
  const seen = new Set();
  process.stdout.write('READY\\n');
  const end = Date.now() + spec.durationMs;
  while (Date.now() < end) { for (const s of sockets()) seen.add(s); await new Promise(r => setTimeout(r, 25)); }
  const c1 = pick(counters());
  process.stdout.write('RESULT' + JSON.stringify({ delta: delta(c0, c1), sockets: [...seen] }));
})().catch(e => { process.stderr.write(String(e && e.stack || e)); process.exit(2); });
`;

export type NetDelta = { udpOut: number; noRoute: number; icmpEcho: number; tcpActiveOpens: number };

/**
 * The monitor's control, inside the product's container as root, BEFORE any window is opened: one DNS lookup
 * of an outside name (`*.invalid`) and one connection to an outside address (TEST-NET 192.0.2.1), each
 * counted by the namespace counters — so the counters are shown to move for exactly the attempts the row
 * forbids, and the outside is shown unreachable (the network has no route out, D-023). It sends nothing to
 * the product process and changes nothing in it.
 */
export async function networkControl(): Promise<{ delta: NetDelta; lookup: string; conn: string }> {
  const { id } = await productContainer();
  const r = await execIn(id, ['node', '-e', NET_SCRIPT, b64json({ mode: 'control', probeName: `vid-outbound-probe-${Date.now()}.invalid`, probeIp: '192.0.2.1', ports: [] })], 60_000);
  if (r.exitCode !== 0) throw new Error(`setup: the network control exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
  return JSON.parse(r.stdout);
}

/**
 * Starts the outbound-attempt monitor in the product's network namespace for `durationMs`: the namespace
 * counters read at its start and end, and every socket seen (polled every 25 ms) whose far end is neither
 * loopback nor unset and whose near end is not one of `listenPorts` (the product's own served port, so
 * inbound connections are not counted). Resolves `ready` once the baseline is read; `result` when the
 * window closes. It reads /proc only; it sends nothing and changes nothing.
 */
export async function networkMonitor(durationMs: number, listenPorts: number[]): Promise<{ ready: Promise<void>; result: Promise<{ delta: NetDelta; sockets: string[] }> }> {
  const { id } = await productContainer();
  let markReady!: () => void;
  const ready = new Promise<void>((r) => (markReady = r));
  const result = execIn(id, ['node', '-e', NET_SCRIPT, b64json({ mode: 'watch', durationMs, ports: listenPorts })], durationMs + 60_000, (soFar) => {
    if (soFar.includes('READY')) markReady();
  }).then((r) => {
    markReady();
    if (r.exitCode !== 0) throw new Error(`setup: the network monitor exited ${r.exitCode}: ${r.stderr.slice(0, 300)}`);
    const at = r.stdout.indexOf('RESULT');
    if (at < 0) throw new Error(`setup: the network monitor gave no result: ${r.stdout.slice(0, 200)}`);
    return JSON.parse(r.stdout.slice(at + 'RESULT'.length));
  });
  return { ready, result };
}

// ─── Inside the product's process: a heap snapshot after a forced garbage collection (ROW-100) ─

// Finds the product's process by its command line (the container's own Cmd), opens its inspector with
// SIGUSR1 (Node's documented signal), and over the inspector protocol on loopback: forces a garbage
// collection, takes a heap snapshot and streams it through the search — the snapshot is never written to
// disk. Then it asks the process to close its inspector again two seconds later, and disconnects.
const HEAP_SCRIPT = `
const fs = require('fs');
const spec = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
const want = JSON.stringify(spec.cmd);
let pid = null; const seen = [];
for (const d of fs.readdirSync('/proc')) {
  if (!/^\\d+$/.test(d) || Number(d) === process.pid) continue;
  let c; try { c = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').split('\\0').filter(Boolean); } catch (e) { continue; }
  seen.push(d + ':' + c.join(' '));
  if (JSON.stringify(c) === want) { pid = Number(d); break; }
}
if (pid === null) { process.stderr.write('no process runs ' + want + '; processes: ' + seen.join(' | ')); process.exit(4); }
(async () => {
  process.kill(pid, 'SIGUSR1');
  let target = null; const until = Date.now() + 15000;
  while (!target && Date.now() < until) {
    try { const l = await (await fetch('http://127.0.0.1:' + spec.port + '/json/list')).json(); if (l.length) target = l[0].webSocketDebuggerUrl; } catch (e) {}
    if (!target) await new Promise(r => setTimeout(r, 200));
  }
  if (!target) { process.stderr.write('the inspector did not open on 127.0.0.1:' + spec.port + ' after SIGUSR1'); process.exit(5); }
  const needles = spec.needles; const control = spec.control;
  const maxLen = Math.max(control.length, ...needles.map(n => n.value.length));
  const found = new Set(); let controlFound = false; let bytes = 0; let carry = '';
  const ws = new WebSocket(target);
  let next = 1; const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => { const id = next++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params: params || {} })); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    if (m.method === 'HeapProfiler.addHeapSnapshotChunk') {
      const s = carry + m.params.chunk; bytes += m.params.chunk.length;
      for (const n of needles) if (s.includes(n.value)) found.add(n.form);
      if (s.includes(control)) controlFound = true;
      carry = s.slice(Math.max(0, s.length - maxLen + 1));
      return;
    }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket error')); });
  await send('HeapProfiler.enable');
  await send('HeapProfiler.collectGarbage');
  await send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  try { await send('Runtime.evaluate', { expression: "setTimeout(() => { try { process.getBuiltinModule('node:inspector').close(); } catch (e) {} }, 2000); 0" }); } catch (e) {}
  ws.close();
  process.stdout.write(JSON.stringify({ found: [...found], controlFound, bytes }));
  process.exit(0);
})().catch(e => { process.stderr.write(String(e && e.stack || e)); process.exit(2); });
`;

/**
 * A heap snapshot of the product's server process after a forced garbage collection, searched in memory for
 * every needle and for `control` (a string any server routing GET /healthz holds). What it does inside the
 * product's container, as root: sends the product's process SIGUSR1, which opens Node's inspector on
 * 127.0.0.1 inside the container; forces one garbage collection and takes one snapshot through it; asks the
 * process to close the inspector two seconds later. It writes no file and sends no check. `setup:` when the
 * process or its inspector cannot be reached (a process started with its inspector signal disabled).
 */
export async function heapSnapshotSearch(needles: readonly Needle[], control: string): Promise<{ found: string[]; controlFound: boolean; bytes: number }> {
  const { id } = await productContainer();
  const product = (await serviceContainers()).find((c) => c.id === id)!;
  const r = await execIn(id, ['node', '-e', HEAP_SCRIPT, b64json({ cmd: product.cmd, port: 9229, needles, control })], 300_000);
  if (r.exitCode !== 0) throw new Error(`setup: the heap snapshot could not be taken (exit ${r.exitCode}): ${r.stderr.slice(0, 400)}`);
  return JSON.parse(r.stdout);
}

// ─── An interrupted check: a request that dies mid-body ──────────────────────────────────────────

/**
 * Sends a check whose body stops half-way — the headers announce the whole JSON body, half of it is
 * written (the offer's start, the markers in it), and 300 ms later the connection is destroyed — the way
 * a writer's dropped connection fails a check. Takes a check slot (`wait` as given). Resolves once the
 * connection is gone; never retries.
 */
export async function sendInterruptedCheck(baseUrl: string, text: string, wait: boolean): Promise<void> {
  await takeCheckSlot({ wait });
  const body = Buffer.from(JSON.stringify({ text }), 'utf8');
  const url = new URL(CHECK_PATH, baseUrl);
  await new Promise<void>((resolve) => {
    const req = httpRequest({
      host: url.hostname,
      port: Number(url.port || 80),
      method: 'POST',
      path: url.pathname,
      headers: { 'content-type': 'application/json', 'content-length': body.length },
    });
    req.on('error', () => resolve());
    req.on('close', () => resolve());
    req.write(body.subarray(0, Math.floor(body.length / 2)), () => {
      setTimeout(() => req.destroy(), 300);
    });
  });
}

// ─── Browser-side readers ────────────────────────────────────────────────────────────────────────

/** One request a browser context sent, as Playwright saw it. */
export type SentRequest = { url: string; method: string; postData: string; resourceType: string; kind: 'request' | 'websocket' | 'rtc' | 'webtransport' | 'link-hint' };

/**
 * Records, from now on, every request any page, frame, worker or service worker of `context` sends
 * (Playwright's context `request` event, which fires before the network is tried, so a request to an
 * unreachable host is still recorded), every WebSocket a page opens, and — through an init script on every
 * new document — every RTCPeerConnection's ICE servers and every WebTransport URL (connections Playwright's
 * request events do not show). `linkHints(page)` adds the page's preconnect/dns-prefetch hints. It never
 * blocks, changes or answers a request.
 */
export async function recordRequests(context: BrowserContext): Promise<{ sent: SentRequest[]; linkHints: (page: Page) => Promise<void>; collectPageSide: (page: Page) => Promise<void> }> {
  const sent: SentRequest[] = [];
  context.on('request', (r) => {
    let postData = '';
    try {
      postData = r.postDataBuffer()?.toString('utf8') ?? '';
    } catch {
      /* no body */
    }
    sent.push({ url: r.url(), method: r.method(), postData, resourceType: r.resourceType(), kind: 'request' });
  });
  const onPage = (page: Page) => page.on('websocket', (ws) => sent.push({ url: ws.url(), method: 'GET', postData: '', resourceType: 'websocket', kind: 'websocket' }));
  context.pages().forEach(onPage);
  context.on('page', onPage);
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __vidOut?: { kind: string; url: string }[] };
    w.__vidOut = w.__vidOut ?? [];
    const out = w.__vidOut;
    const RTC = w.RTCPeerConnection as (new (cfg?: { iceServers?: { urls: string | string[] }[] }) => unknown) | undefined;
    if (RTC) {
      const Wrapped = function (this: unknown, cfg?: { iceServers?: { urls: string | string[] }[] }) {
        for (const s of cfg?.iceServers ?? []) for (const u of ([] as string[]).concat(s.urls)) out.push({ kind: 'rtc', url: u });
        if (!cfg?.iceServers?.length) out.push({ kind: 'rtc', url: 'rtc:(default ICE servers)' });
        return new RTC(cfg);
      } as unknown as typeof RTC;
      (Wrapped as unknown as { prototype: unknown }).prototype = (RTC as unknown as { prototype: unknown }).prototype;
      w.RTCPeerConnection = Wrapped;
    }
    const WT = w.WebTransport as (new (url: string, o?: unknown) => unknown) | undefined;
    if (WT) {
      w.WebTransport = function (url: string, o?: unknown) {
        out.push({ kind: 'webtransport', url: String(url) });
        return new WT(url, o);
      } as unknown as typeof WT;
    }
  });
  const linkHints = async (page: Page) => {
    const hints = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel]'))
        .filter((l) => /(^|\s)(preconnect|dns-prefetch)(\s|$)/i.test(l.getAttribute('rel') ?? ''))
        .map((l) => (l as HTMLLinkElement).href),
    );
    for (const h of hints) sent.push({ url: h, method: 'HINT', postData: '', resourceType: 'link-hint', kind: 'link-hint' });
  };
  const collectPageSide = async (page: Page) => {
    const extra = await page.evaluate(() => (window as unknown as { __vidOut?: { kind: string; url: string }[] }).__vidOut ?? []);
    for (const e of extra) sent.push({ url: e.url, method: 'CONNECT', postData: '', resourceType: e.kind, kind: e.kind as SentRequest['kind'] });
  };
  return { sent, linkHints, collectPageSide };
}

/** Whether `url` names the product's own server (same host and port as `productUrl`). Non-network schemes (data:, blob:, about:) count as own. */
export function isOwnServer(url: string, productUrl: string): boolean {
  if (/^(data|blob|about|javascript):/i.test(url)) return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const own = new URL(productUrl);
  return u.host === own.host;
}

/** `s` with every percent-escape decoded (one pass, malformed escapes left as they are). */
export function percentDecoded(s: string): string {
  return s.replace(/(%[0-9a-f]{2})+/gi, (m) => {
    try {
      return decodeURIComponent(m);
    } catch {
      return m;
    }
  });
}

/** The box's current text, as the writer sees it: its value for a text field, its text otherwise. */
export async function boxText(page: Page): Promise<string> {
  return el(page, ROLES.offer).first().evaluate((e) => ('value' in e ? String((e as HTMLTextAreaElement).value) : (e as HTMLElement).innerText));
}

/**
 * Presses the check button as the device does (tap on touch, click otherwise) after taking a check slot,
 * WITHOUT waiting for a request — for a check the page may refuse before sending anything (REQ-021).
 */
export async function pressCheckNoWait(page: Page): Promise<void> {
  await takeCheckSlot();
  const button = el(page, ROLES.check).first();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await button.tap();
  else await button.click();
}

/** The visible text of the page's message element (data-element="message"), '' when absent or hidden. */
export async function messageText(page: Page): Promise<string> {
  const m = el(page, ROLES.message).first();
  if ((await m.count()) === 0 || !(await m.isVisible())) return '';
  return ((await m.innerText()) ?? '').trim();
}

/** Waits (15 s) until the page shows a message different from `before`; returns it. Fails naming `what`. */
export async function expectNewMessage(page: Page, before: string, what: string): Promise<string> {
  let now = '';
  await expect
    .poll(async () => {
      now = await messageText(page);
      return now !== '' && now !== before;
    }, { message: what, timeout: 15_000 })
    .toBe(true);
  return now;
}

/** Everything the four browser stores of REQ-018 hold for the page's origin, each as one string. */
export type BrowserStores = { localStorage: string; sessionStorage: string; indexedDB: string; cookies: string; indexedDBListed: boolean };

/**
 * Reads the page origin's local storage, session storage, every IndexedDB database (every object store's
 * keys and values, Blobs and binary values decoded as text) and every cookie of the context (HttpOnly
 * included, through the context). One evaluation, no navigation. It writes nothing.
 */
export async function readBrowserStores(page: Page): Promise<BrowserStores> {
  const inPage = await page.evaluate(async () => {
    const norm = async (v: unknown, depth = 0): Promise<unknown> => {
      if (depth > 8) return '[deep]';
      if (v === null || typeof v !== 'object') return v;
      if (v instanceof Blob) return await v.text();
      if (v instanceof ArrayBuffer) return new TextDecoder('utf-8', { fatal: false }).decode(v);
      if (ArrayBuffer.isView(v)) return new TextDecoder('utf-8', { fatal: false }).decode(v as ArrayBufferView);
      if (v instanceof Date) return v.toISOString();
      if (v instanceof Map) return Promise.all([...v].map(async ([k, x]) => [await norm(k, depth + 1), await norm(x, depth + 1)]));
      if (v instanceof Set || Array.isArray(v)) return Promise.all([...(v as Iterable<unknown>)].map((x) => norm(x, depth + 1)));
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = await norm(x, depth + 1);
      return o;
    };
    const dump = (s: Storage) => {
      const o: Record<string, string | null> = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)!;
        o[k] = s.getItem(k);
      }
      return JSON.stringify(o);
    };
    const idb: unknown[] = [];
    let listed = false;
    if (typeof indexedDB.databases === 'function') {
      listed = true;
      for (const info of await indexedDB.databases()) {
        if (!info.name) continue;
        const db = await new Promise<IDBDatabase>((res, rej) => {
          const r = indexedDB.open(info.name!);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const stores: unknown[] = [];
        for (const s of Array.from(db.objectStoreNames)) {
          const tx = db.transaction(s, 'readonly');
          const st = tx.objectStore(s);
          const [keys, values] = await Promise.all([
            new Promise<unknown[]>((res, rej) => {
              const r = st.getAllKeys();
              r.onsuccess = () => res(r.result as unknown[]);
              r.onerror = () => rej(r.error);
            }),
            new Promise<unknown[]>((res, rej) => {
              const r = st.getAll();
              r.onsuccess = () => res(r.result as unknown[]);
              r.onerror = () => rej(r.error);
            }),
          ]);
          stores.push({ store: s, keys: await norm(keys), values: await norm(values) });
        }
        db.close();
        idb.push({ db: info.name, stores });
      }
    }
    return { local: dump(localStorage), session: dump(sessionStorage), idb: JSON.stringify(idb), listed, docCookie: document.cookie };
  });
  const cookies = await page.context().cookies();
  return {
    localStorage: inPage.local,
    sessionStorage: inPage.session,
    indexedDB: inPage.idb,
    cookies: JSON.stringify(cookies) + '\n' + inPage.docCookie + '\n' + cookies.map((c) => percentDecoded(c.value)).join('\n'),
    indexedDBListed: inPage.listed,
  };
}

/**
 * Plants one fresh control value in each of the four stores (a local- and a session-storage key, an
 * IndexedDB database of its own, a cookie for the product's origin) so a reader can be shown to see each
 * store. Touches no key, database or cookie of the product's.
 */
export async function plantStoreControls(page: Page, productUrl: string, value: string): Promise<void> {
  await page.evaluate(async (v) => {
    localStorage.setItem('vid-control', v);
    sessionStorage.setItem('vid-control', v);
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open('vid-control-' + v, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('c');
      r.onsuccess = () => {
        const tx = r.result.transaction('c', 'readwrite');
        tx.objectStore('c').put(v, 'k');
        tx.oncomplete = () => {
          r.result.close();
          res();
        };
        tx.onerror = () => rej(tx.error);
      };
      r.onerror = () => rej(r.error);
    });
  }, value);
  await page.context().addCookies([{ name: 'vidcontrol', value, url: productUrl }]);
}

/**
 * Searches every regular file under `dir` (a browser profile on the tests runner's own disk) whose path below
 * `dir` matches `only` (default: every file) for every needle: raw bytes, and every gzip stream found at any
 * offset in a file (a cached response body is stored as the server sent it). Returns the matches and how many
 * files it read. Reads only.
 */
export function searchLocalDirectory(dir: string, needles: readonly Needle[], only: RegExp = /./): { matches: { path: string; form: string }[]; files: number } {
  const bufs = needles.map((n) => ({ form: n.form, buf: Buffer.from(n.value, 'utf8') }));
  const matches: { path: string; form: string }[] = [];
  let files = 0;
  const walk = (p: string) => {
    let st;
    try {
      st = lstatSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const n of readdirSync(p)) walk(p + '/' + n);
      return;
    }
    if (!st.isFile() || st.size > 256 << 20 || !only.test(p.slice(dir.length))) return;
    let data: Buffer;
    try {
      data = readFileSync(p);
    } catch {
      return;
    }
    files++;
    const views: Buffer[] = [data];
    let at = data.indexOf(Buffer.from([0x1f, 0x8b, 0x08]));
    for (let tries = 0; at !== -1 && tries < 200; tries++) {
      try {
        views.push(gunzipSync(data.subarray(at), { finishFlush: zc.Z_SYNC_FLUSH }));
      } catch {
        /* not a gzip stream here */
      }
      at = data.indexOf(Buffer.from([0x1f, 0x8b, 0x08]), at + 1);
    }
    for (const b of bufs) if (views.some((v) => v.indexOf(b.buf) !== -1)) matches.push({ path: p, form: b.form });
  };
  walk(dir);
  return { matches, files };
}
