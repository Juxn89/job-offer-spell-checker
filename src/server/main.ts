// Purpose: the HTTP server's process entry point (`@revisor/server`): serves the page, its assets and
// the privacy note, the check endpoint and the readiness route, every route taken from routes.ts.
//
// Skeleton state (golden-path example, REQ-001): the page reaches the check endpoint and the
// endpoint reaches the checker, end to end; the limits, headers, operator log and refusals of
// REQ-017 to REQ-022 and REQ-027 are not built yet.

import Fastify, { type RouteHandlerMethod } from 'fastify';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, isReady, loadDictionary } from '@revisor/checker';
import { ROUTES } from './routes.js';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const pageHtml = readFileSync(WEB_DIR + 'index.html');
const privacyHtml = readFileSync(WEB_DIR + 'privacidad.html');
const assetFiles = new Map<string, { body: Buffer; type: string }>();
for (const name of readdirSync(WEB_DIR + 'assets')) {
  const type = name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
  assetFiles.set(name, { body: readFileSync(WEB_DIR + 'assets/' + name), type });
}

// REQ-027: Fastify's own logger stays off; the operator log is built by its step.
const app = Fastify({ logger: false });

const handlers: Record<string, RouteHandlerMethod> = {
  'GET /': async (_req, reply) => reply.type('text/html; charset=utf-8').send(pageHtml),
  'GET /assets/:name': async (req, reply) => {
    const asset = assetFiles.get((req.params as { name: string }).name);
    if (!asset) return reply.code(404).type('text/plain; charset=utf-8').send('No encontrado');
    return reply.type(asset.type).send(asset.body);
  },
  'GET /privacidad': async (_req, reply) => reply.type('text/html; charset=utf-8').send(privacyHtml),
  // REQ-001: the check endpoint hands the body's text to the checker and returns its flags (D-020).
  'POST /api/check': async (req, reply) => {
    const text = (req.body as { text?: unknown } | undefined)?.text;
    if (typeof text !== 'string') return reply.code(400).send({ error: 'malformed' });
    return reply.send({ v: 1, ...check(text) });
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

loadDictionary();
await app.listen({ host: '0.0.0.0', port: PORT });
