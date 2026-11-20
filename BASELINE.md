# Revisor ortográfico de ofertas — BASELINE

One page: what the stack IS, what it is NOT, and the rows that must never break.

## Stack

| Layer | Choice | FORBIDDEN alternatives (named) |
|---|---|---|
| Language / runtime | TypeScript 5 on Node.js 22 LTS, versions pinned in the lockfile and the Docker image tag | Python (Django, Flask, FastAPI), Deno, Bun, untyped JavaScript source |
| Server framework | Fastify 5: the check endpoint, the static page, security headers | Express, Koa, NestJS, Hapi, Next.js, any serverless function platform |
| Spelling engine | nspell (Hunspell-compatible, pure JS) with the LibreOffice Spanish dictionary (RLA-ES, `dictionary-es`), vendored into the repository; the built-in term list ships beside it | LanguageTool, Grammarly, any spelling, language or AI web service (OpenAI, Anthropic, Google), nodehun native bindings, typo-js |
| Page | One plain HTML page with a TypeScript client script bundled by esbuild; all assets served from our own server | React, Vue, Angular, Svelte, jQuery, any CDN-hosted script, font or style (Google Fonts, Tailwind CDN) |
| Storage | None: no database, no file cache; the text lives in memory for the duration of one request (REQ-018, REQ-029) | PostgreSQL, SQLite, Redis, MongoDB, any on-disk cache |
| Abuse limit | In-memory sliding window per network address inside the server process (REQ-022, REQ-032) | Redis or any external rate-limit store, a CDN or WAF rate limiter |
| Logging | Operator log of kind and time only (REQ-027); Fastify's request logging off; no error-reporting service | Sentry, Datadog agent, any analytics or tracking (Google Analytics, Plausible, Matomo) |
| TLS and edge | Caddy on our own VPS terminates HTTPS with Let's Encrypt certificates (REQ-020, REQ-038) | Cloudflare proxy, AWS CloudFront, any platform edge or managed load balancer that decrypts traffic, a second proxy (nginx) |
| Hosting | One Hetzner Cloud VPS in the EU, Docker Compose (app + Caddy) | Fly.io, Render, Vercel, Netlify, Heroku, Kubernetes |
| Tests | Vitest (unit and HTTP), Playwright on Chromium, WebKit and Firefox (page, clipboard, phone width; REQ-042), axe-core (WCAG 2.2 AA) | Jest, Mocha, Cypress, Puppeteer |

## Module seams & data ownership

The seam table lives in ARCHITECTURE.md. Ownership law: each table/data store
is written by exactly one module; everyone else goes through that module's
public surface. Here the only data are the dictionary and the term list,
owned by `src/checker`, and the in-memory address window, owned by
`src/server`.

## Tier-0 rows

| Rule | Meaning |
|---|---|
| REQ-017 — no egress of the offer's text | The offer's text is sent to no destination other than our own server. Neither the page nor the server passes it, or any part of it, to an outside service. The check uses no outside spelling, language or AI service. |
| REQ-018 — the text is never kept | The text is held in memory only while its check runs. It is never written to a file, database, cache, any log (application, Caddy, access or error), an error report or the browser's storage, including when a check fails or is refused. |
| REQ-038 — no third-party decryption | The check request is decrypted only on machines under the product's own hosting account. No CDN, security proxy or platform edge terminates its TLS, and no hosting or platform log records a request body. |
| No credentials in the repository | No password, token or key appears in any file, commit, test or log. Access is recorded only by its shape in ARCHITECTURE.md's vid-hosting block. |

## Test environment

The ledger runs ONLY inside Docker: `sh checks/test.sh` → docker compose -f
docker-compose.test.yml. No test process ever receives real credentials.

## Owner hints (verbatim)

- Design: Plain, no design pass
- Architecture/stack: You pick

## Machine blocks

Parsed by checks/conformance.sh at every commit. Extensions space- or
newline-separated. Forbidden terms one per line: dependency/import names that
must never appear in staged source additions — pick tokens that will not
legitimately occur in code or config otherwise.

```vid-allowed-extensions
.md .yml .yaml .sh .json .ts .mjs .js .html .css .svg .txt .aff .dic .lock .xml
```

```vid-forbidden
"express":
"koa":
@nestjs/
"react":
"vue":
jquery
"jest":
"cypress":
"puppeteer":
languagetool
"openai":
@anthropic-ai/
@sentry/
dd-trace
googletagmanager
google-analytics
plausible.io
fonts.googleapis
ioredis
better-sqlite3
mongoose
nodehun
typo-js
```
