// Purpose: the HTTP server's process entry point (`@revisor/server`): serves the page, its assets and
// the privacy note, the check endpoint and the readiness route, every route taken from routes.ts; holds
// the check limits (REQ-021, REQ-022), the cross-site refusal (REQ-039) and the security headers (REQ-020).
// The offer's text lives only in the request's memory: never logged, cached or written (REQ-017, REQ-018).

import Fastify, { type FastifyReply, type FastifyRequest, type RouteHandlerMethod } from 'fastify';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, isReady, loadDictionary } from '@revisor/checker';
import { ROUTES } from './routes.js';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const CHARACTER_LIMIT = 10_000; // REQ-021, A-013
const CHECKS_PER_MINUTE = 30; // REQ-022, A-013
const WINDOW_MS = 60_000;

const pageHtml = readFileSync(WEB_DIR + 'index.html');
const privacyHtml = readFileSync(WEB_DIR + 'privacidad.html');
const assetFiles = new Map<string, { body: Buffer; type: string }>();
for (const name of readdirSync(WEB_DIR + 'assets')) {
  const type = name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
  assetFiles.set(name, { body: readFileSync(WEB_DIR + 'assets/' + name), type });
}

// REQ-020: the page runs only its own script and style, loads nothing from other sites and cannot be framed.
const PAGE_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};

// REQ-022, REQ-032, A-037: one network address is one IPv4 address or one IPv6 /64; its check times
// are held in memory for the one-minute window only, then forgotten.
const recent = new Map<string, number[]>();
function addressKey(req: FastifyRequest): string {
  let ip = req.socket.remoteAddress ?? 'unknown';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip.includes(':')) return ip;
  const groups = ip.split('::');
  const head = groups[0].split(':').filter(Boolean);
  const tail = groups.length > 1 ? groups[1].split(':').filter(Boolean) : [];
  const full = [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail];
  return full.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
function forget(now: number): void {
  for (const [key, times] of recent) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) recent.delete(key);
    else recent.set(key, kept);
  }
}
setInterval(() => forget(Date.now()), 10_000).unref();
function allowCheck(req: FastifyRequest): boolean {
  const now = Date.now();
  const key = addressKey(req);
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= CHECKS_PER_MINUTE) {
    recent.set(key, times);
    return false;
  }
  times.push(now);
  recent.set(key, times);
  return true;
}

// REQ-039, A-038: a check sent from a page on another website is refused.
function crossSite(req: FastifyRequest): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site === 'cross-site' || site === 'same-site') return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

const graphemeCount = (t: string): number => {
  let n = 0;
  for (const _ of new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)) n++;
  return n;
};

// REQ-027: Fastify's own logger stays off; nothing about a request is logged.
const app = Fastify({ logger: false, bodyLimit: 512 * 1024 });

const refuse = (reply: FastifyReply, code: number, error: string, extra: Record<string, unknown> = {}) =>
  reply.code(code).header('cache-control', 'no-store').send({ error, ...extra });

const handlers: Record<string, RouteHandlerMethod> = {
  'GET /': async (_req, reply) => reply.headers(PAGE_HEADERS).type('text/html; charset=utf-8').send(pageHtml),
  'GET /assets/:name': async (req, reply) => {
    const asset = assetFiles.get((req.params as { name: string }).name);
    if (!asset) return reply.code(404).type('text/plain; charset=utf-8').send('No encontrado');
    return reply.header('x-content-type-options', 'nosniff').header('cache-control', 'public, max-age=31536000, immutable').type(asset.type).send(asset.body);
  },
  'GET /privacidad': async (_req, reply) => reply.headers(PAGE_HEADERS).type('text/html; charset=utf-8').send(privacyHtml),
  // REQ-001: the check endpoint hands the body's text to the checker and returns its flags (D-020).
  'POST /api/check': async (req, reply) => {
    if (crossSite(req)) return refuse(reply, 403, 'cross-site');
    if (!isReady()) return refuse(reply, 503, 'not-ready');
    const text = (req.body as { text?: unknown } | undefined)?.text;
    if (typeof text !== 'string') return refuse(reply, 400, 'malformed');
    if (text.length > CHARACTER_LIMIT * 8 || graphemeCount(text) > CHARACTER_LIMIT) return refuse(reply, 413, 'too-long', { limit: CHARACTER_LIMIT });
    if (!allowCheck(req)) return reply.header('retry-after', '60').code(429).header('cache-control', 'no-store').send({ error: 'rate-limited' });
    return reply.header('cache-control', 'no-store').send({ v: 1, ...check(text) });
  },
  // REQ-025: ready only once the dictionary is loaded.
  'GET /healthz': async (_req, reply) =>
    isReady() ? reply.send({ ready: true }) : reply.code(503).send({ ready: false }),
};

for (const route of ROUTES) {
  const handler = handlers[`${route.method} ${route.path}`];
  if (!handler) throw new Error(`route ${route.method} ${route.path} has no handler`);
  app.route({ method: route.method, url: route.path, handler });
}

app.setNotFoundHandler((_req, reply) => reply.code(404).type('text/plain; charset=utf-8').send('No encontrado'));
// REQ-018, REQ-025: an error answer never echoes the request.
app.setErrorHandler((error, _req, reply) => {
  const status = (error as { statusCode?: unknown }).statusCode;
  const code = typeof status === 'number' && status >= 400 && status < 500 ? status : 500;
  return refuse(reply, code, code === 413 ? 'too-long' : code < 500 ? 'malformed' : 'server-error');
});

loadDictionary();
await app.listen({ host: '0.0.0.0', port: PORT });
