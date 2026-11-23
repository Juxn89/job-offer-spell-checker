// Purpose: ledger test for ROW-093 (REQ-020) — paths such as /.env, /.git/config, /Caddyfile, the compose
// file, package.json, any dotfile and any directory return the plain not-found page; only the page, its
// built assets and the privacy note are served.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); the promise comes
// from ROW-093 (REQ-020, A-024), never from the product's source.
//
// Test argument
// ROW-093 promise: REQ-020 (A-024) as ROW-093 states it — the files behind the product (secrets, VCS,
// ROW-093   proxy and compose configuration, the package manifest), any dotfile and any directory get the
// ROW-093   plain not-found page; only the built page assets and the privacy note are served.
// ROW-093 wrong product: a static handler rooted at the project or dist folder serves /package.json or
// ROW-093   /.env; it serves dotfiles under /assets/ (/assets/.env); it lists /assets/ as a directory or
// ROW-093   redirects it; it decodes %2f in /assets/..%2fpackage.json and walks out of the assets folder;
// ROW-093   or it answers these paths with a different error ("403 Forbidden", a stack trace, a JSON
// ROW-093   error naming the route) that tells an attacker the file exists or names the framework.
// ROW-093 given: the not-found page as the product answers a fresh, never-seen path (a fresh marker), its
// ROW-093   status 404 and its body holding no copy of the path. when: each probe path is requested with
// ROW-093   GET through the raw API door (no redirect followed). then: every probe answers 404 with the
// ROW-093   same content type and the very same body as that not-found page — the plain not-found page,
// ROW-093   indistinguishable from a path that never existed.
// ROW-093 controls: the control case shows the page, every asset it references under /assets/ and the
// ROW-093   privacy note are served 200 — the server is up and serves what it should, so the target's
// ROW-093   404s are refusals of the probes, not a server answering 404 to everything.
// ROW-093 technique: a fresh reference path per run (no product can special-case it) and the whole
// ROW-093   probe population compared to it, including fresh dotfile names at the root and under /assets/,
// ROW-093   directories with and without a trailing slash, and encoded traversals out of /assets/.
// ROW-093 cases: ROW-093 target=tests/invariants/test-req020-row093-no-stray-files-served.api.spec.ts::[api]ROW-093_files,_dotfiles_and_directories_get_the_plain_not-found_page control=tests/invariants/test-req020-row093-no-stray-files-served.api.spec.ts::[api]ROW-093_control:_the_page,_its_assets_and_the_privacy_note_are_served

import { expect, test } from '@playwright/test';
import { freshMarker, sendRaw } from './harness';

function probes(): string[] {
  const dot = freshMarker();
  return [
    '/.env', '/.env.production', '/.env.local', '/.git/config', '/.git/HEAD', '/.git/', '/.git',
    '/.gitignore', '/.dockerignore', '/.htaccess', '/.claude/settings.json', '/.vid/RUN-STATE.md',
    `/.${dot}`, `/assets/.${dot}`, '/assets/.env', '/assets/.git/config',
    '/Caddyfile', '/deploy/Caddyfile', '/docker-compose.yml', '/docker-compose.yaml', '/compose.yml', '/compose.yaml',
    '/deploy/docker-compose.yml', '/deploy/compose.yml', '/docker-compose.test.yml', '/Dockerfile', '/deploy/Dockerfile',
    '/package.json', '/package-lock.json', '/tsconfig.json', '/playwright.config.ts', '/esbuild.config.mjs',
    '/src/', '/src', '/src/server/', '/src/web/', '/dist/', '/dist', '/dist/server/main.js', '/node_modules/',
    '/tests/', '/deploy/', '/deploy', '/checks/', '/assets/', '/assets',
    '/assets/..%2fpackage.json', '/assets/..%2f..%2fpackage.json', '/assets/%2e%2e%2fpackage.json',
    '/assets/..%5cpackage.json', '/assets/%2e%2e%5cpackage.json', '/assets/..%2f.env',
  ];
}

test('ROW-093 control: the page, its assets and the privacy note are served', async () => {
  const pageRes = await sendRaw({ method: 'GET', path: '/' });
  expect(pageRes.status, 'ROW-093 control: the checker page is served').toBe(200);
  const assets = [
    ...new Set(
      Array.from(pageRes.body.matchAll(/\b(?:src|href)\s*=\s*["']?((?:https?:\/\/[^/"']+)?\/?assets\/[^"'\s>]+)/gi)).map((m) =>
        new URL(m[1], 'http://product.test/').pathname,
      ),
    ),
  ];
  expect(assets.length, 'ROW-093 control: the checker page references its built assets under /assets/').toBeGreaterThan(0);
  for (const a of assets) {
    const r = await sendRaw({ method: 'GET', path: a });
    expect(r.status, `ROW-093 control: the page's asset ${a} is served`).toBe(200);
  }
  const note = await sendRaw({ method: 'GET', path: '/privacidad' });
  expect(note.status, 'ROW-093 control: the privacy note is served').toBe(200);
});

test('ROW-093 files, dotfiles and directories get the plain not-found page', async () => {
  const never = `/${freshMarker()}`;
  const notFound = await sendRaw({ method: 'GET', path: never });
  expect(notFound.status, 'ROW-093: a path that never existed is answered 404').toBe(404);
  expect(notFound.body, 'ROW-093: the not-found page holds no copy of the path asked for').not.toContain(never.slice(1));
  const type = notFound.headers['content-type'] ?? '';

  const wrong: string[] = [];
  for (const path of probes()) {
    const r = await sendRaw({ method: 'GET', path });
    const same = r.status === 404 && (r.headers['content-type'] ?? '') === type && r.body === notFound.body;
    if (!same) {
      wrong.push(`${path} → ${r.status} ${r.headers['content-type'] ?? '-'}${r.headers.location ? ` location ${r.headers.location}` : ''} ${JSON.stringify(r.body.slice(0, 80))}`);
    }
  }
  expect(wrong, 'ROW-093: every probe path is answered with the plain not-found page, exactly as a path that never existed').toEqual([]);
});
