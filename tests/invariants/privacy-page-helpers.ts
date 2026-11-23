// Purpose: shared setup for the privacy-page batch's ledger tests (REQ-018, REQ-019, REQ-020, REQ-032,
// REQ-033): a fresh offer carrying one known misspelling, the footer's privacy-link door, the offer
// box's text as the writer sees it, browser-storage observation, the tests container's own address,
// and an accent- and case-insensitive reading of Spanish prose.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); nothing here is
// produced by, imported from, or read out of the product's source. It reaches the product only through
// the harness client's doors (./harness) and the page Playwright hands each test.

import { networkInterfaces } from 'node:os';
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { accentPopulation, compose, el, fillerWords, readHighlights, ROLES, type Rng } from './harness';

const WAIT_MS = 15_000;

// ─── Spanish prose, read the way a person reads it ───────────────────────────────────────────────

/**
 * A plain reading of Spanish text for matching: Unicode-normalised, accents and other combining marks
 * removed (á→a, ñ→n, ü→u), lower case, whitespace collapsed. Patterns matched against it are written
 * without accents.
 */
export function plainReading(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A statement that something is NOT kept: a negation followed within a few words by keep/store/save. */
export const NOT_KEPT =
  /\b(no|nunca|jamas|ni)\b(\s+\S+){0,4}?\s+(se\s+)?(guard|almacen|conserv|registr)\w*|\bsin\s+(guardar|almacenar|conservar|registrar)\w*/;

/** An email address, as text. */
export const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;

// ─── A fresh offer with one known misspelling ────────────────────────────────────────────────────

export type MisspelledOffer = {
  /** The whole offer. */
  text: string;
  /** The misspelled word: a dictionary word with its acute accent removed (the dictionary oracle). */
  misspelled: string;
  /** The dictionary word it was made from. */
  correct: string;
  /** Where the misspelled word stands in `text` (UTF-16 offset), computed before anything is sent. */
  start: number;
};

/**
 * A fresh offer of correctly spelled filler words with exactly one misspelling in its middle: a word
 * from the dictionary oracle's accent population with its accent removed (REQ-001 flags it), chosen by
 * the test's own fresh randomness so no product can hard-code it.
 */
export function misspelledOffer(rng: Rng): MisspelledOffer {
  const pair = rng.pick(accentPopulation());
  const f = fillerWords();
  const tokens = [rng.pick(f), rng.pick(f), rng.pick(f), pair.stripped, rng.pick(f), rng.pick(f)];
  const { text, placed } = compose(tokens);
  return { text, misspelled: pair.stripped, correct: pair.word, start: placed[3].start };
}

/**
 * Waits (polling, 15 s) until the page shows exactly one highlight of the offer's misspelled word, at its
 * own position, visible and marked — the observation that the check really ran and was drawn.
 */
export async function expectMisspellingShown(page: Page, offer: MisspelledOffer, why: string): Promise<void> {
  await expect
    .poll(
      async () =>
        (await readHighlights(page, offer.text))
          .filter((h) => h.word === offer.misspelled)
          .map((h) => ({ start: h.start, visible: h.visible, marked: h.marked })),
      { timeout: WAIT_MS, message: why },
    )
    .toEqual([{ start: offer.start, visible: true, marked: true }]);
}

// ─── The writer's hand on the page ───────────────────────────────────────────────────────────────

/** Operates a control the way the device does: a tap on a touch device, a click otherwise. */
export async function operate(page: Page, control: Locator): Promise<void> {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await control.tap({ timeout: WAIT_MS });
  else await control.click({ timeout: WAIT_MS });
}

/** The offer box's text as the writer sees it: a text field's value, or an editable element's text. */
export async function readOfferText(page: Page): Promise<string> {
  return el(page, ROLES.offer)
    .first()
    .evaluate((e) =>
      e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement ? e.value : (e as HTMLElement).innerText,
    );
}

/** How the privacy note was shown after its footer link was operated. */
export type NoteOpened = {
  /** The page showing the note: the checker's own tab, or a tab the link opened. */
  note: Page;
  /** `new-tab` — another tab; `same-tab-navigated` — the checker's tab moved to another URL;
   *  `same-tab-in-page` — the note was shown in the checker's page without leaving it. */
  how: 'new-tab' | 'same-tab-navigated' | 'same-tab-in-page';
};

/**
 * The footer's privacy-link door: finds the privacy link INSIDE the footer (data-element="footer" →
 * data-element="privacy-link"), failing by name when either is missing; operates it; and waits (15 s)
 * until the note (data-element="privacy-note") is visible — in a tab the link opened, or in the
 * checker's own tab. It never types, never checks, and never reads storage.
 */
export async function followFooterPrivacyLink(page: Page): Promise<NoteOpened> {
  const footer = el(page, ROLES.footer);
  await expect(footer.first(), 'the checker page has a footer (data-element="footer")').toBeVisible({ timeout: WAIT_MS });
  const link = footer.first().locator(`[data-element="${ROLES.privacyLink}"]`);
  await expect(link.first(), 'the footer holds the privacy-note link (data-element="privacy-link")').toBeVisible({ timeout: WAIT_MS });
  const urlBefore = page.url();
  const context = page.context();
  const popup = context.waitForEvent('page', { timeout: WAIT_MS }).then(
    (p) => p,
    () => null,
  );
  const sameTab = el(page, ROLES.privacyNote)
    .first()
    .waitFor({ state: 'visible', timeout: WAIT_MS })
    .then(
      () => 'shown' as const,
      () => null,
    );
  await operate(page, link.first());
  const first = await Promise.race([popup, sameTab]);
  if (first && first !== 'shown') {
    await first.waitForLoadState('load');
    await expect(el(first, ROLES.privacyNote).first(), 'the tab the privacy link opened shows the note (data-element="privacy-note")').toBeVisible({ timeout: WAIT_MS });
    return { note: first, how: 'new-tab' };
  }
  const late = first === 'shown' ? null : await popup;
  if (late) {
    await late.waitForLoadState('load');
    await expect(el(late, ROLES.privacyNote).first(), 'the tab the privacy link opened shows the note (data-element="privacy-note")').toBeVisible({ timeout: WAIT_MS });
    return { note: late, how: 'new-tab' };
  }
  await expect(el(page, ROLES.privacyNote).first(), 'following the footer privacy link shows the note (data-element="privacy-note")').toBeVisible({ timeout: WAIT_MS });
  return { note: page, how: page.url() === urlBefore ? 'same-tab-in-page' : 'same-tab-navigated' };
}

/** The note's text, read from its element as shown, and its reading units. */
export type NoteReading = {
  /** The whole note, as plainReading. */
  whole: string;
  /** Its reading units, each as plainReading: every innermost block (a paragraph, a list item, a table
   *  row, a cell — an element laid out as a block with no block inside it) and every heading together
   *  with what follows it up to the next heading of the same or a higher level. */
  units: string[];
  /** The addresses of the note's mailto: links. */
  mailto: string[];
};

/** Reads the visible privacy note (data-element="privacy-note") into its reading units. */
export async function readNote(note: Page): Promise<NoteReading> {
  const raw = await el(note, ROLES.privacyNote)
    .first()
    .evaluate((root) => {
      const inline = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents', 'none']);
      const isBlock = (e: Element) => !inline.has(getComputedStyle(e).display);
      const units: string[] = [];
      for (const e of Array.from(root.querySelectorAll('*'))) {
        if (!isBlock(e) || getComputedStyle(e).display === 'none') continue;
        if (Array.from(e.querySelectorAll('*')).some(isBlock)) continue;
        units.push((e as HTMLElement).innerText ?? e.textContent ?? '');
      }
      const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      const all = Array.from(root.querySelectorAll('*'));
      for (const h of headings) {
        const level = Number(h.tagName[1]);
        let text = (h as HTMLElement).innerText ?? '';
        const startAt = all.indexOf(h);
        for (let i = startAt + 1; i < all.length; i++) {
          const n = all[i];
          if (/^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) <= level) break;
          if (h.contains(n)) continue;
          if (!isBlock(n) || Array.from(n.querySelectorAll('*')).some(isBlock)) continue;
          text += '\n' + ((n as HTMLElement).innerText ?? '');
        }
        units.push(text);
      }
      const mailto = Array.from(root.querySelectorAll('a[href^="mailto:" i]')).map((a) =>
        decodeURIComponent((a.getAttribute('href') ?? '').replace(/^mailto:/i, '').split('?')[0]),
      );
      return { whole: (root as HTMLElement).innerText ?? '', units, mailto };
    });
  return {
    whole: plainReading(raw.whole),
    units: raw.units.map(plainReading).filter((u) => u.length > 0),
    mailto: raw.mailto,
  };
}

// ─── Browser storage, observed ───────────────────────────────────────────────────────────────────

/** Everything the browser keeps for the product's origin, as the page and the context see it. */
export type StorageSnapshot = {
  localStorage: number;
  sessionStorage: number;
  indexedDB: string[];
  cacheStorage: string[];
  documentCookie: string;
  contextCookies: string[];
};

/** Reads every browser store the page's origin can write, plus the context's cookies (httpOnly included). */
export async function storageSnapshot(page: Page): Promise<StorageSnapshot> {
  const inPage = await page.evaluate(async () => {
    // IndexedDB and CacheStorage exist only where the engine offers them (CacheStorage only in a secure
    // context): a store the engine does not offer to this origin holds nothing the page could have written.
    let idb: string[] = [];
    try {
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
        idb = (await indexedDB.databases()).map((d) => d.name ?? '');
      }
    } catch {
      idb = [];
    }
    let cacheStorage: string[] = [];
    try {
      if (typeof caches !== 'undefined') cacheStorage = await caches.keys();
    } catch {
      cacheStorage = [];
    }
    return {
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDB: idb,
      cacheStorage,
      documentCookie: document.cookie,
    };
  });
  const cookies = await page.context().cookies();
  return { ...inPage, contextCookies: cookies.map((c) => `${c.name} (${c.domain})`) };
}

/** A snapshot holding nothing at all — what every StorageSnapshot must equal. */
export const EMPTY_STORAGE: StorageSnapshot = {
  localStorage: 0,
  sessionStorage: 0,
  indexedDB: [],
  cacheStorage: [],
  documentCookie: '',
  contextCookies: [],
};

/**
 * Records every attempt any page of the context makes to write browser storage — Storage.setItem
 * (local and session), indexedDB.open, a document.cookie write, CacheStorage.open, cookieStore.set —
 * from the next navigation on. Call it before the first navigation. Returns the live list of attempts.
 * Writes that bypass these entry points (a property set on localStorage) are caught by storageSnapshot.
 */
export async function recordStorageWrites(context: BrowserContext): Promise<string[]> {
  const writes: string[] = [];
  await context.exposeBinding('__vidStorageWrite', (source, kind: string) => {
    writes.push(`${kind} on ${source.page?.url() ?? 'a page'}`);
  });
  await context.addInitScript(() => {
    const w = window as unknown as { __vidStorageWrite?: (k: string) => unknown };
    const report = (kind: string) => {
      try {
        void w.__vidStorageWrite?.(kind);
      } catch {
        /* the binding is gone with the page */
      }
    };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      report(this === window.sessionStorage ? 'sessionStorage.setItem' : 'localStorage.setItem');
      return setItem.call(this, key, value);
    };
    if (typeof IDBFactory !== 'undefined') {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (this: IDBFactory, ...args: [string, number?]) {
        report('indexedDB.open');
        return open.apply(this, args as [string, number]);
      };
    }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cookie?.get && cookie.set) {
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get() {
          return cookie.get!.call(this);
        },
        set(v: string) {
          report('document.cookie');
          cookie.set!.call(this, v);
        },
      });
    }
    if (typeof CacheStorage !== 'undefined') {
      const openCache = CacheStorage.prototype.open;
      CacheStorage.prototype.open = function (this: CacheStorage, name: string) {
        report('caches.open');
        return openCache.call(this, name);
      };
    }
    const cs = (window as unknown as { cookieStore?: { set?: (...a: unknown[]) => unknown } }).cookieStore;
    if (cs && typeof cs.set === 'function') {
      const set = cs.set.bind(cs);
      cs.set = (...a: unknown[]) => {
        report('cookieStore.set');
        return set(...a);
      };
    }
  });
  return writes;
}

// ─── The tests container's own address ───────────────────────────────────────────────────────────

/**
 * The IPv4 addresses of this tests container's own network interfaces (loopback aside) — the address
 * every request the harness sends arrives from, as the product sees it on the ledger network (there is
 * no proxy in the harness, D-025). Fails `setup:` when there is none.
 */
export function ownIPv4Addresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  if (out.length === 0) throw new Error('setup: the tests container has no non-loopback IPv4 address');
  return out;
}

/** A pattern matching `ip` as a whole address (not inside a longer number such as 172.18.0.30). */
export function wholeAddress(ip: string): RegExp {
  return new RegExp(`(?<![0-9.])${ip.replace(/\./g, '\\.')}(?![0-9])`);
}
