// Purpose: the suggestions batch's page helpers over the harness client — opening a highlighted
// word's suggestion menu by pointer, tap or keyboard, reading and operating the menu, reading the
// box's text, the count line and the selection, the clipboard probe (a scratch page that copies and
// pastes with the browser's own keyboard commands) and the refused-clipboard browser fake.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch suggestions); nothing here is
// produced by, imported from, or read out of the product's source.
//
// The page contract these helpers select by (D-021: "new elements get a role the same way"; D-028 the
// highlight): inside the page, the open suggestion menu of a highlighted word is an element carrying
// data-element="menu", visible while open and absent or hidden once closed; inside it each suggestion
// is an element carrying data-element="suggestion" whose own text is exactly the word it puts in the
// text, the Ignore choice carries data-element="ignore", and a word with no suggestion shows an element
// carrying data-element="no-suggestions" (its text "Sin sugerencias"). The count line is
// data-element="count" (D-021); the confirmation or instruction after Copy text is shown in
// data-element="message" (D-021). Nothing here selects by class, tag or visible wording.
//
// What these helpers never do: they never send a check (the harness's `pressCheck` does, on the shared
// budget), never set the box's text except through the browser's own input paths, never read the check
// endpoint's answer, and never assert — the tests assert.

import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { el, fillerWords, ROLES, type Placed, type Rng } from './harness';

/** The menu's element identifiers (see the contract above). */
export const MENU = {
  menu: 'menu',
  suggestion: 'suggestion',
  ignore: 'ignore',
  noSuggestions: 'no-suggestions',
} as const;

const WAIT_MS = 15_000;

/** True when the page's device reports touch (the phone project, or a phone context a test made). */
export async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.maxTouchPoints > 0);
}

/**
 * Lets the page finish what the last event started: two animation frames and a task, after bringing
 * the page to the front (a background page gets no frames). A readiness wait, never a fixed sleep.
 */
export async function settle(page: Page): Promise<void> {
  await page.bringToFront();
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))),
  );
}

/** A flag as these helpers find it: its place in DOM order (for the locator) and its place in the text. */
export type FlagAt = { domIndex: number; word: string; start: number; active: boolean };

/**
 * Every highlight (data-element="flag") with its DOM index and its offset in `text`, the same reading
 * the harness's `readHighlights` makes (the nearest enclosing element whose text is `text`, or `text`
 * with its line breaks removed); `active` when the focused element is the flag, inside it, or holds it
 * as its only flag. Sorted by position. One evaluation, no navigation.
 */
export async function flagsAt(page: Page, text: string): Promise<FlagAt[]> {
  const found = await page.evaluate((t: string) => {
    const trimEnd = (s: string) => s.replace(/[\s​﻿]+$/u, '');
    const noBreaks = t.replace(/\r\n|\r|\n/g, '');
    const back: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] !== '\n' && t[i] !== '\r') back.push(i);
    back.push(t.length);
    const act = document.activeElement;
    const flags = Array.from(document.querySelectorAll('[data-element="flag"]'));
    return flags.map((node, domIndex) => {
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
      const active =
        !!act &&
        (act === f || f.contains(act) || (act.contains(f) && act.querySelectorAll('[data-element="flag"]').length === 1));
      return { domIndex, word, start, active };
    });
  }, text);
  return [...found].sort((a, b) => a.start - b.start);
}

/** The highlight standing at `start` in `text`; fails the test by name when there is none. */
export async function flagLocator(page: Page, text: string, start: number, row: string): Promise<Locator> {
  const f = (await flagsAt(page, text)).find((x) => x.start === start);
  if (!f) throw new Error(`${row}: no highlight stands at offset ${start} of the text (${JSON.stringify(text.slice(start, start + 20))}…)`);
  return el(page, ROLES.flag).nth(f.domIndex);
}

/** The open menu: the first visible data-element="menu". */
export function openMenu(page: Page): Locator {
  return el(page, MENU.menu).filter({ visible: true }).first();
}

/** What an open menu shows; `open: false` when no menu is visible. */
export type MenuView = { open: boolean; suggestions: string[]; ignore: number; noSuggestions: string | null };

/** Reads the open menu: its visible suggestions' own texts (trimmed, in order), its Ignore choices, its "Sin sugerencias" note. */
export async function readMenu(page: Page): Promise<MenuView> {
  const menus = el(page, MENU.menu).filter({ visible: true });
  if ((await menus.count()) === 0) return { open: false, suggestions: [], ignore: 0, noSuggestions: null };
  const m = menus.first();
  const suggestions = (await m.locator(`[data-element="${MENU.suggestion}"]`).filter({ visible: true }).allTextContents()).map((s) => s.trim());
  const ignore = await m.locator(`[data-element="${MENU.ignore}"]`).filter({ visible: true }).count();
  const none = m.locator(`[data-element="${MENU.noSuggestions}"]`).filter({ visible: true });
  const noSuggestions = (await none.count()) ? ((await none.first().textContent()) ?? '').trim() : null;
  return { open: true, suggestions, ignore, noSuggestions };
}

/** Clicks, or taps on a touch device, the centre of `target` — where the writer's finger or pointer lands. */
export async function pointAt(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded({ timeout: WAIT_MS });
  const box = await target.boundingBox();
  if (!box) throw new Error('the element to press has no box on screen');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (await isTouch(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/**
 * Presses `role`'s element through its own actionability (click, or tap on touch) — for the menu's
 * choices and the page's buttons.
 */
export async function press(page: Page, target: Locator): Promise<void> {
  if (await isTouch(page)) await target.tap({ timeout: WAIT_MS });
  else await target.click({ timeout: WAIT_MS });
}

/** Opens the menu of the highlight at `start` by pointer (click, or tap on touch) and waits for it. */
export async function openMenuByPointer(page: Page, text: string, start: number, row: string): Promise<void> {
  await pointAt(page, await flagLocator(page, text, start, row));
  await expect(openMenu(page), `${row}: pressing the highlighted word at offset ${start} opens its menu (data-element="menu")`).toBeVisible({ timeout: WAIT_MS });
}

/**
 * Moves the keyboard focus with Tab (forward, at most `max` presses) until `isThere` says the focused
 * element is the one sought; returns false when it never was. Keyboard only — no click, no focus().
 */
export async function tabUntil(page: Page, isThere: () => Promise<boolean>, max = 60, key = 'Tab'): Promise<boolean> {
  for (let i = 0; i <= max; i++) {
    if (await isThere()) return true;
    await page.keyboard.press(key);
  }
  return isThere();
}

/** The data-element role of the focused element (or of its nearest ancestor that carries one). */
export async function activeRole(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.closest('[data-element]')?.getAttribute('data-element') ?? null);
}

/** Opens the menu of the highlight at `start` from the keyboard: Tab to it, then Enter; waits for the menu. */
export async function openMenuByEnter(page: Page, text: string, start: number, row: string): Promise<void> {
  const reached = await tabUntil(page, async () => (await flagsAt(page, text)).some((f) => f.start === start && f.active));
  expect(reached, `${row}: the highlighted word at offset ${start} is reached by Tab from the keyboard`).toBe(true);
  await page.keyboard.press('Enter');
  await expect(openMenu(page), `${row}: Enter on the highlighted word at offset ${start} opens its menu (data-element="menu")`).toBeVisible({ timeout: WAIT_MS });
}

/** Chooses the open menu's suggestion whose own text is `label` (click, or tap on touch). */
export async function chooseSuggestion(page: Page, label: string, row: string): Promise<void> {
  const choice = openMenu(page).locator(`[data-element="${MENU.suggestion}"]`).filter({ visible: true }).filter({ hasText: label });
  const exact = [];
  for (let i = 0; i < (await choice.count()); i++) if (((await choice.nth(i).textContent()) ?? '').trim() === label) exact.push(choice.nth(i));
  expect(exact.length, `${row}: the open menu offers the suggestion "${label}"`).toBeGreaterThan(0);
  await press(page, exact[0]);
}

/** Chooses the open menu's Ignore (click, or tap on touch). */
export async function chooseIgnore(page: Page, row: string): Promise<void> {
  const ignore = openMenu(page).locator(`[data-element="${MENU.ignore}"]`).filter({ visible: true });
  expect(await ignore.count(), `${row}: the open menu shows Ignore (data-element="ignore")`).toBeGreaterThan(0);
  await press(page, ignore.first());
}

/** The offer box's text as the writer has it: a text field's value, or the box's rendered text. */
export async function readOfferText(page: Page): Promise<string> {
  return el(page, ROLES.offer)
    .first()
    .evaluate((e) => (e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement ? e.value : (e as HTMLElement).innerText));
}

/** The count line as the writer sees it: shown (visible, non-empty), its text, and the first whole number in it. */
export type CountView = { shown: boolean; text: string; n: number | null };

export async function readCount(page: Page): Promise<CountView> {
  const c = el(page, ROLES.count).filter({ visible: true });
  if ((await c.count()) === 0) return { shown: false, text: '', n: null };
  const text = ((await c.first().textContent()) ?? '').trim();
  const m = text.match(/\d+/);
  return { shown: text !== '', text, n: m ? Number(m[0]) : null };
}

/** The visible text of the page's message element(s) (D-021 `message`), joined; '' when none shows. */
export async function readMessage(page: Page): Promise<string> {
  const m = el(page, ROLES.message).filter({ visible: true });
  return (await m.allTextContents()).map((s) => s.trim()).filter(Boolean).join(' | ');
}

/** The selection in the offer box: the selected text, and whether the box holds the focus (a selection a writer can see). */
export async function readOfferSelection(page: Page): Promise<{ selected: string; focused: boolean }> {
  return el(page, ROLES.offer)
    .first()
    .evaluate((e) => {
      const focused = document.activeElement === e || e.contains(document.activeElement);
      if (e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement) {
        return { selected: e.value.slice(e.selectionStart ?? 0, e.selectionEnd ?? 0), focused };
      }
      const sel = window.getSelection();
      const inBox = !!sel && sel.rangeCount > 0 && e.contains(sel.getRangeAt(0).commonAncestorContainer);
      return { selected: inBox ? sel!.toString() : '', focused };
    });
}

/** Puts the caret at the end of the box from the keyboard (focus, Ctrl/Cmd+End) and types `s` key by key. */
export async function typeAtEnd(page: Page, s: string): Promise<void> {
  await page.bringToFront();
  await el(page, ROLES.offer).first().focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(s);
}

/** Puts the caret at the start of the box from the keyboard (focus, Ctrl/Cmd+Home) and types `s` key by key. */
export async function typeAtStart(page: Page, s: string): Promise<void> {
  await page.bringToFront();
  await el(page, ROLES.offer).first().focus();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.type(s);
}

/**
 * Builds an offer's tokens: before each anchor 1–2 filler words (dictionary words no rule flags), one
 * after the last. Positions come from the harness's `compose`.
 */
export function sprinkle(rng: Rng, anchors: readonly string[]): string[] {
  const fillers = fillerWords();
  const tokens: string[] = [];
  for (const a of anchors) {
    for (let i = rng.int(2); i >= 0; i--) tokens.push(rng.pick(fillers));
    tokens.push(a);
  }
  tokens.push(rng.pick(fillers));
  return tokens;
}

/** The text after replacing the word at `p` with `by` (the test's own model of a Replace). */
export function replacedAt(text: string, p: Placed, by: string): string {
  return text.slice(0, p.start) + by + text.slice(p.end);
}

// ─── The clipboard probe (the browser's own copy and paste, in a scratch page of the same context) ──

const SCRATCH = '<!doctype html><meta charset="utf-8"><title>scratch</title><textarea id="t" rows="20" cols="80"></textarea><div id="h" contenteditable="true" style="min-height:2em"></div>';

/**
 * A scratch page in `context` — about:blank content, no network — holding a plain text field and a
 * rich editable area, the writer's other program. Opened once per test and reused.
 */
export async function scratchPage(context: BrowserContext): Promise<Page> {
  const s = await context.newPage();
  await s.setContent(SCRATCH);
  return s;
}

/** Puts `text` on the clipboard with the browser's own copy (select all in the scratch text field, Ctrl/Cmd+C). */
export async function putOnClipboard(scratch: Page, text: string): Promise<void> {
  await scratch.bringToFront();
  const t = scratch.locator('#t');
  await t.fill(text);
  await t.focus();
  await scratch.keyboard.press('ControlOrMeta+A');
  await scratch.keyboard.press('ControlOrMeta+C');
}

/** Puts formatted `html` on the clipboard with the browser's own copy from the scratch rich area. */
export async function putRichOnClipboard(scratch: Page, html: string): Promise<void> {
  await scratch.bringToFront();
  await scratch.locator('#h').evaluate((h, v) => {
    h.innerHTML = v;
  }, html);
  await scratch.locator('#h').focus();
  await scratch.keyboard.press('ControlOrMeta+A');
  await scratch.keyboard.press('ControlOrMeta+C');
}

/**
 * Reads the clipboard with the browser's own paste: into the scratch text field (the plain text) and
 * into the scratch rich area (what a word processor would receive: `richHtml`, and whether it carries
 * any formatting — an element other than a line break or a paragraph, or any style, colour or link).
 */
export async function readClipboard(scratch: Page): Promise<{ text: string; richHtml: string; richFormatted: boolean }> {
  await scratch.bringToFront();
  const t = scratch.locator('#t');
  await t.fill('');
  await t.focus();
  await scratch.keyboard.press('ControlOrMeta+V');
  const text = await t.inputValue();
  const h = scratch.locator('#h');
  await h.evaluate((x) => {
    x.innerHTML = '';
  });
  await h.focus();
  await scratch.keyboard.press('ControlOrMeta+V');
  const rich = await h.evaluate((x) => {
    const formatted = Array.from(x.querySelectorAll('*')).some((n) => {
      const tag = n.tagName.toLowerCase();
      if (['br', 'div', 'p'].includes(tag) && !n.getAttribute('style') && !n.getAttribute('class') && !n.hasAttribute('data-element')) return false;
      return true;
    });
    return { richHtml: x.innerHTML, richFormatted: formatted };
  });
  return { text, ...rich };
}

/**
 * Pastes the clipboard into the offer box with the browser's own paste (focus the box, Ctrl/Cmd+V) —
 * the way a writer's paste lands, unlike the harness's `enterOffer`.
 */
export async function pasteIntoOffer(page: Page): Promise<void> {
  await page.bringToFront();
  await el(page, ROLES.offer).first().focus();
  await page.keyboard.press('ControlOrMeta+V');
}

/**
 * The refused-clipboard browser fake (the browser is the external party here): from the next
 * navigation of `page`, every clipboard write the page attempts is refused the way a browser refuses
 * one — navigator.clipboard.write/writeText reject with NotAllowedError, document.execCommand('copy'
 * or 'cut') returns false, and a permission query for the clipboard answers "denied". The writer's own
 * keyboard copy (Ctrl/Cmd+C) is not touched. Call before `openChecker`.
 */
export async function refuseClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const refuse = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
    try {
      const c = (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
      if (c) {
        Object.defineProperty(c, 'writeText', { value: refuse, configurable: true });
        Object.defineProperty(c, 'write', { value: refuse, configurable: true });
      }
    } catch {
      /* nothing to refuse */
    }
    const exec = Document.prototype.execCommand;
    Document.prototype.execCommand = function (cmd: string, ...rest: unknown[]) {
      if (/^(copy|cut)$/i.test(String(cmd))) return false;
      return (exec as (...a: unknown[]) => boolean).call(this, cmd, ...rest);
    };
    const perms = navigator.permissions;
    if (perms && perms.query) {
      const q = perms.query.bind(perms);
      Object.defineProperty(perms, 'query', {
        configurable: true,
        value: (d: { name?: string }) =>
          /clipboard/.test(String(d?.name))
            ? Promise.resolve({ state: 'denied', name: d.name, onchange: null, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
            : q(d as PermissionDescriptor),
      });
    }
  });
}

/** A message that says the text was copied (and does not say it was not). */
export function claimsCopied(message: string): boolean {
  return /copiad[oa]s?\b/i.test(message) && !/\bno\s+(se\s+)?(ha\s+|han\s+|pudo\s+|puede\s+)?(sido\s+)?(podido\s+)?copia/i.test(message);
}

/** The keyboard shortcut a refused copy must name: Ctrl+C, or Cmd+C on a Mac (Comando or ⌘ accepted). */
export const CTRL_C = /\b(ctrl|control)\s*\+\s*c\b/i;
export const CMD_C = /(\bcmd\s*\+\s*c\b|⌘\s*\+?\s*c\b|\bcomando\s*\+\s*c\b)/i;

/** Whether the page's device presents itself as a Mac (by its platform, or its user agent). */
export async function macSignals(page: Page): Promise<{ platform: boolean; userAgent: boolean }> {
  return page.evaluate(() => ({ platform: /mac/i.test(navigator.platform), userAgent: /Macintosh|Mac OS X/.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent) }));
}
