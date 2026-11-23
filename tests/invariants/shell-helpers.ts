// Purpose: the shell batch's helpers (ROW-076, ROW-077, ROW-078, ROW-080) — reading a served HTML
// answer the way a link checker does (its language, visible text and links), telling Spanish text from
// text in another language by the dictionary oracle, finding what an error page must never reveal, and
// resolving a link from a page. A public harness boundary beside the harness client; imported, never
// collected.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch shell); nothing here is
// produced by, imported from, or read out of the product's source — it reads only what the product
// serves over the network.

import type { APIRequestContext } from '@playwright/test';
import { isDictionaryWord, PRODUCT_URL } from './harness';

// ─── Spanish text, by the dictionary oracle ──────────────────────────────────────────────────────

/** An email address as it is written in running text. */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/**
 * Reads `text` as words (runs of letters, after email addresses and web addresses are taken out) and
 * returns them with the ones the Spanish dictionary oracle does not hold — neither as written nor in
 * lower case (a capitalised first word), not an all-capital acronym of 5 letters or fewer, and not a
 * capitalised word inside a sentence (a proper noun). The first word of the text, of each sentence
 * and after a colon always counts.
 * "Not Found", "Check spelling" and "Copy text" each yield foreign words; "Página no encontrada",
 * "Revisar ortografía" and "Copiar texto" yield none. It never consults the product.
 */
export function spanishReading(text: string): { words: string[]; foreign: string[] } {
  const cleaned = text
    .replace(new RegExp(EMAIL_RE.source, 'g'), ' ')
    .replace(/\b(?:https?|mailto|tel):\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ');
  const words: string[] = [];
  const foreign: string[] = [];
  const re = /\p{L}+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const w = m[0];
    words.push(w);
    if (isDictionaryWord(w) || isDictionaryWord(w.toLowerCase())) continue;
    if (w.length <= 5 && w === w.toUpperCase() && /\p{Lu}/u.test(w)) continue; // an acronym
    // A capitalised word inside a sentence reads as a proper noun (a company, a person, a place — the
    // reading A-012 gives the checker); the first word of a text or of a sentence gets no such reading.
    const before = cleaned.slice(0, m.index).replace(/\s+$/u, '');
    const sentenceStart = before === '' || /[.!?¡¿:;\n]$/u.test(before);
    if (!sentenceStart && /^\p{Lu}\p{Ll}+$/u.test(w)) continue;
    foreign.push(w);
  }
  return { words, foreign };
}

// ─── A served HTML answer, read as a link checker reads it ───────────────────────────────────────

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', middot: '·', mdash: '—',
  ndash: '–', hellip: '…', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
};

/** Decodes HTML character references; an unknown named one becomes a space (never a stray word). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (_, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
    }
    return NAMED[ref] ?? ' ';
  });
}

/** The `lang` of the document's <html> element, or null when it carries none. */
export function htmlLang(html: string): string | null {
  const m = /<html\b[^>]*?\blang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : null;
}

/**
 * The text a reader sees in the document's body: comments, <head>, <script>, <style>, <template> and
 * <noscript> removed, tags turned into spaces, character references decoded, whitespace collapsed.
 */
export function htmlVisibleText(html: string): string {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, ' ')
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(body).replace(/\s+/g, ' ').trim();
}

/** Every <a href> (and <area href>) of the document, as written (character references decoded). */
export function htmlLinks(html: string): string[] {
  const out: string[] = [];
  const re = /<(?:a|area)\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(decodeEntities(m[1] ?? m[2] ?? m[3] ?? '').trim());
  return out;
}

/** True when `href`, resolved from the page at `pageUrl`, is the checker page: the product's own origin, path `/`. */
export function isCheckerAddress(href: string, pageUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(href, pageUrl);
  } catch {
    return false;
  }
  return u.origin === new URL(PRODUCT_URL).origin && u.pathname === '/' && u.search === '';
}

// ─── What an error page must never reveal (REQ-025, ROW-077) ─────────────────────────────────────

/**
 * The marks of an internal error leaking to a visitor: a stack frame, an error class, a file-system path
 * or a source location, and a server framework's or runtime's name or error code. Matched against a
 * response's body and its header values. A URL path the page links to (/assets/…, /privacidad) is not a
 * file path here: only the file-system roots below are.
 */
export const LEAK_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'stack frame', re: /\bat\s+(?:[\w$.<>[\]]+\s+)?\(?(?:file:\/\/|node:|\/|[A-Za-z]:\\)[^\s)]*:\d+(?::\d+)?\)?/ },
  { name: 'error class', re: /\b(?:TypeError|SyntaxError|ReferenceError|RangeError|EvalError|URIError|AggregateError)\b/ },
  {
    name: 'file-system path',
    re: /(?:^|[\s"'(=:,[])(?:file:\/\/)?\/(?:app|usr|home|root|opt|srv|var|etc|tmp|proc|src|dist|build|lib|node_modules)\/[^\s"'<>)]*/,
  },
  { name: 'node_modules', re: /node_modules/ },
  { name: 'source location', re: /\.(?:[cm]?js|tsx?)(?::\d+){1,2}\b/ },
  { name: 'windows path', re: /\b[A-Za-z]:\\[^\s"'<>]+/ },
  { name: 'framework or runtime name', re: /\b(?:express|fastify|koa|hapi|restify|nestjs|next\.js|nuxt|node\.js|nodejs|undici)\b/i },
  { name: 'framework error code', re: /\b(?:FST_[A-Z_]+|ERR_[A-Z_]{3,})\b/ },
  { name: 'runtime internals', re: /node:internal|internal\/(?:modules|process|http)/ },
];

/** Every leak mark found in a response — `<pattern>: <the matched text>` — in its body and header values. */
export function leaksIn(res: { headers: Record<string, string>; body: string }): string[] {
  const headerText = Object.entries(res.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const found: string[] = [];
  for (const where of [
    { label: 'body', text: res.body },
    { label: 'headers', text: headerText },
  ]) {
    for (const p of LEAK_PATTERNS) {
      const m = p.re.exec(where.text);
      if (m) found.push(`${p.name} in ${where.label}: ${JSON.stringify(m[0].trim().slice(0, 120))}`);
    }
  }
  return found;
}

// ─── Resolving a link (ROW-080) ──────────────────────────────────────────────────────────────────

export type LinkVerdict = {
  /** The href as the page carries it. */
  href: string;
  /** The page it was found on. */
  from: string;
  /** `resolves`, `broken` or `outside` (another host: unreachable from the harness's internal network). */
  verdict: 'resolves' | 'broken' | 'outside';
  /** Why, in a few words. */
  why: string;
};

/**
 * Resolves one link the way a visitor's follow would: a link to the product's own origin is fetched
 * (GET, redirects followed, through `request` — never a check, never the check budget) and resolves when
 * the final answer is 2xx and, when the link names a #fragment, that page carries an element with that
 * id or name; `mailto:` resolves when it names well-formed addresses; `tel:` when it names a number; an
 * empty href, `javascript:`, `data:` or an unparsable URL is broken; any other origin is `outside` — the
 * harness's network has no route out (D-023), so it can be judged well-formed (https, a host) and no
 * more. It never clicks and never changes the page.
 */
export async function resolveLink(request: APIRequestContext, href: string, from: string): Promise<LinkVerdict> {
  const verdict = (v: LinkVerdict['verdict'], why: string): LinkVerdict => ({ href, from, verdict: v, why });
  if (href === '') return verdict('broken', 'empty href');
  let u: URL;
  try {
    u = new URL(href, from);
  } catch {
    return verdict('broken', 'not a URL');
  }
  if (u.protocol === 'mailto:') {
    const addresses = decodeURIComponent(u.pathname).split(',').map((a) => a.trim());
    const all = new RegExp(`^${EMAIL_RE.source}$`);
    return addresses.length > 0 && addresses.every((a) => all.test(a))
      ? verdict('resolves', `mail to ${addresses.join(', ')}`)
      : verdict('broken', `malformed address ${JSON.stringify(u.pathname)}`);
  }
  if (u.protocol === 'tel:') {
    return /^\+?[\d\s().-]{6,}$/.test(decodeURIComponent(u.pathname)) ? verdict('resolves', 'a phone number') : verdict('broken', 'malformed number');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return verdict('broken', `a ${u.protocol} link leads nowhere`);
  if (u.origin !== new URL(PRODUCT_URL).origin) {
    return u.protocol === 'https:' && u.hostname.includes('.')
      ? verdict('outside', `another host (${u.host}), unreachable from the harness`)
      : verdict('broken', `another host over ${u.protocol} (${u.host})`);
  }
  const target = new URL(u.href);
  target.hash = '';
  const res = await request.get(target.href, { maxRedirects: 5, failOnStatusCode: false, timeout: 30_000 });
  if (res.status() < 200 || res.status() > 299) return verdict('broken', `answered ${res.status()}`);
  if (u.hash.length > 1) {
    const id = decodeURIComponent(u.hash.slice(1)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = await res.text();
    if (!new RegExp(`\\b(?:id|name)\\s*=\\s*["']?${id}["'\\s>]`).test(body)) return verdict('broken', `no element #${u.hash.slice(1)} on ${target.pathname}`);
  }
  return verdict('resolves', `answered ${res.status()}`);
}
