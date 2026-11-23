// Purpose: the journeys batch's helpers (ROW-081, ROW-082) — a real paste of a formatted offer into the
// checker's box, a real read of the system clipboard, the box's text and formatting as the writer sees
// them, the count line's numbers, and operating a control or a highlighted word the way the device does.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch journeys); nothing here is
// produced by, imported from, or read out of the product's source. It imports only the harness client.
//
// Contract (for the journeys files and any later journeys pass): every function below acts through the
// browser the way a writer does — a trusted keyboard shortcut, a click or a tap — and never sets the
// box's value, never dispatches a synthetic event on the product's page and never reads the product's
// own state. The clipboard is the browser's own: a helper page (about:blank, never the product's page)
// puts the offer on it with both a text/plain and a text/html flavour, the way a word processor's copy
// does, and reads it back by a real paste into a plain text area of its own.
//
// Element roles (D-021's rule, "new elements get a role the same way"): besides the harness's roles,
// these helpers select the open suggestion list's choices by data-element="suggestion" (one element per
// suggestion, in the list's order, most likely first, its text exactly the suggested word) and its Ignore
// choice by data-element="ignore". The caller records this contract as a decision, as D-028 did for flag.

import { expect, type Locator, type Page } from '@playwright/test';
import { CHECK_PATH, el, isDictionaryWord, pressCheck } from './harness';

const WAIT_MS = 15_000;

/** The roles this batch adds under D-021's rule: a suggestion choice, and the Ignore choice. */
export const JOURNEY_ROLES = { suggestion: 'suggestion', ignore: 'ignore' } as const;

/** True when the page's device is a touch device (the harness's `phone` project). */
export async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.maxTouchPoints > 0);
}

/**
 * Presses a control (a button, a suggestion, Ignore) the way the device does: a tap on a touch device, a
 * click otherwise — with Playwright's own actionability checks (visible, enabled, not covered).
 */
export async function pressControl(page: Page, control: Locator): Promise<void> {
  if (await isTouch(page)) await control.tap({ timeout: WAIT_MS });
  else await control.click({ timeout: WAIT_MS });
}

/**
 * Clicks (or taps) the screen at the centre of `target` — what a writer does to a highlighted word: the
 * pointer lands where the word is drawn, whatever element lies on top there (the box itself, or the
 * highlight). Scrolls it into view first; fails by name when it has no box on screen.
 */
export async function pointAt(page: Page, target: Locator, what: string): Promise<void> {
  await target.scrollIntoViewIfNeeded({ timeout: WAIT_MS });
  const box = await target.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) throw new Error(`${what} has no box on screen to click`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (await isTouch(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/**
 * Puts an offer on the browser's clipboard as a word processor's copy does — `plain` as text/plain and
 * `html` as text/html — from a helper page of its own (about:blank), then proves the clipboard carries
 * it by pasting it (a trusted ControlOrMeta+V) into a plain text area on that helper page: `setup:` when
 * the pasted value is not exactly `plain`. Closes the helper page and brings `page` back to the front.
 * It never touches the product's page.
 */
export async function putOnClipboard(page: Page, offer: { plain: string; html: string }): Promise<void> {
  const helper = await page.context().newPage();
  try {
    await helper.setContent('<!doctype html><meta charset="utf-8"><textarea id="probe" rows="8" cols="60"></textarea><button id="copy" type="button">copy</button>');
    await helper.evaluate(({ plain, html }) => {
      document.addEventListener('copy', (e) => {
        e.clipboardData?.setData('text/plain', plain);
        e.clipboardData?.setData('text/html', html);
        e.preventDefault();
      });
      document.getElementById('copy')?.addEventListener('click', () => {
        document.execCommand('copy');
      });
    }, offer);
    await helper.bringToFront();
    await helper.click('#copy', { timeout: WAIT_MS });
    await helper.click('#probe', { timeout: WAIT_MS });
    await helper.keyboard.press('ControlOrMeta+V');
    await helper.waitForFunction(() => (document.getElementById('probe') as HTMLTextAreaElement).value.length > 0, undefined, { timeout: 5_000 }).catch(() => undefined);
    const probe = await helper.inputValue('#probe');
    if (probe !== offer.plain) {
      throw new Error(`setup: this browser's clipboard did not carry the offer (a paste into a plain text area gave ${JSON.stringify(probe.slice(0, 120))})`);
    }
  } finally {
    await helper.close();
  }
  await page.bringToFront();
}

/**
 * Reads the browser's clipboard as the job board would receive it: a trusted paste (ControlOrMeta+V)
 * into a plain text area on a helper page of its own (about:blank), which it then closes, bringing
 * `page` back to the front. Returns exactly what was pasted ('' when the clipboard held no text).
 */
export async function readClipboard(page: Page): Promise<string> {
  const reader = await page.context().newPage();
  let value = '';
  try {
    await reader.setContent('<!doctype html><meta charset="utf-8"><textarea id="sink" rows="8" cols="60"></textarea>');
    await reader.bringToFront();
    await reader.click('#sink', { timeout: WAIT_MS });
    await reader.keyboard.press('ControlOrMeta+V');
    await reader.waitForFunction(() => (document.getElementById('sink') as HTMLTextAreaElement).value.length > 0, undefined, { timeout: 5_000 }).catch(() => undefined);
    value = await reader.inputValue('#sink');
  } finally {
    await reader.close();
  }
  await page.bringToFront();
  return value;
}

/**
 * Pastes the clipboard into the checker's box as the writer does: a click (or tap) into the box, then a
 * trusted ControlOrMeta+V. It never sets the box's value.
 */
export async function pasteIntoOffer(page: Page): Promise<void> {
  const box = el(page, 'offer').first();
  await pressControl(page, box);
  await page.keyboard.press('ControlOrMeta+V');
}

/**
 * The offer box's text as the writer sees it: a text area's or input's value; otherwise the element's
 * rendered text (innerText), with one trailing line break a rendered box adds dropped. Line breaks as \n.
 */
export async function readOfferText(page: Page): Promise<string> {
  return el(page, 'offer').first().evaluate((n) => {
    if (n instanceof HTMLTextAreaElement || n instanceof HTMLInputElement) return n.value.replace(/\r\n?/g, '\n');
    return (n as HTMLElement).innerText.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  });
}

/**
 * The formatting the offer box shows on its text, as a list of findings (empty when the text is plain):
 * for a text area or input, none can exist; otherwise every text node inside the box whose element is a
 * link, bold, italic, underline or font element, or is drawn in a weight, style, colour, decoration or
 * background different from the box's own. Read before any check, when no highlight is drawn.
 */
export async function formattingInOffer(page: Page): Promise<string[]> {
  return el(page, 'offer').first().evaluate((box) => {
    if (box instanceof HTMLTextAreaElement || box instanceof HTMLInputElement) return [];
    const own = getComputedStyle(box);
    const out: string[] = [];
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const text = (n as Text).data;
      if (text.trim() === '') continue;
      let p: HTMLElement | null = n.parentElement;
      while (p && p !== box) {
        if (/^(A|B|STRONG|I|EM|U|FONT|S|STRIKE|MARK)$/.test(p.tagName)) out.push(`${JSON.stringify(text.trim())} inside <${p.tagName.toLowerCase()}>`);
        p = p.parentElement;
      }
      const cs = getComputedStyle(n.parentElement as HTMLElement);
      for (const prop of ['fontWeight', 'fontStyle', 'color', 'textDecorationLine', 'backgroundColor'] as const) {
        if (n.parentElement !== box && cs[prop] !== own[prop] && !(prop === 'backgroundColor' && /rgba\(0, 0, 0, 0\)|transparent/.test(cs[prop]))) {
          out.push(`${JSON.stringify(text.trim())} drawn with ${prop} ${cs[prop]} (the box: ${own[prop]})`);
        }
      }
    }
    return out;
  });
}

/** What a status line shows: whether it is visible, its visible text, and the numbers written in it. */
export type LineReading = { visible: boolean; text: string; numbers: string[] };

/** Reads the first element of `role` (D-021): visible or not, its visible text, the digit runs in it. */
export async function readLine(page: Page, role: string): Promise<LineReading> {
  const line = el(page, role).first();
  if ((await line.count()) === 0) return { visible: false, text: '', numbers: [] };
  const visible = await line.isVisible();
  const text = visible ? (await line.innerText()).trim() : '';
  return { visible, text, numbers: text.match(/\d+/g) ?? [] };
}

/**
 * A statement that no spelling errors were found, in the page's language (A-020: Spanish): a negation
 * (no, sin, ningún/ninguna, cero, 0) followed in the same sentence by error(es) or falta(s) — "No se
 * encontraron errores ortográficos", "Sin faltas de ortografía", "Ningún error", "0 errores".
 */
export const NO_ERRORS = /(^|[^\p{L}\d])(no|sin|ningún|ninguna|ninguno|cero|0)(?=[^\p{L}\d])[^.!?]*?(error|falta)/iu;

/** The visible choices of the open suggestion list, in the page's order (data-element="suggestion"). */
export function suggestions(page: Page): Locator {
  return el(page, JOURNEY_ROLES.suggestion).filter({ visible: true });
}

/** The visible Ignore choice of the open suggestion list (data-element="ignore"). */
export function ignoreChoice(page: Page): Locator {
  return el(page, JOURNEY_ROLES.ignore).filter({ visible: true });
}

/** The highlighted word whose own text is exactly `word` (data-element="flag", D-028). */
export function flagFor(page: Page, word: string): Locator {
  return el(page, 'flag').filter({ hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
}

/** Waits (15 s) for `locator` to match at least one element, failing with `message`. */
export async function waitPresent(locator: Locator, message: string): Promise<void> {
  await expect(locator.first(), message).toBeVisible({ timeout: WAIT_MS });
}

/** One piece of an offer: its text, an optional formatting (in the text/html flavour only), an optional key. */
export type Segment = { text: string; fmt?: 'bold' | 'link' | 'colour'; key?: string };

/** An offer as the writer copies it: its plain text, its formatted HTML, and where each keyed piece stands. */
export type Offer = { plain: string; html: string; at: Record<string, { start: number; end: number; word: string }> };

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Builds an offer from segments: `plain` is their texts joined; `html` the same text as a word
 * processor's HTML (bold, a link, a colour where a segment asks; <br> for each line break; &nbsp; for
 * every space after the first of a run and at a line's start, so the HTML shows the same spacing); `at`
 * the UTF-16 offsets of each keyed segment, recorded by the test before anything is sent.
 */
export function buildOffer(segments: readonly Segment[]): Offer {
  let plain = '';
  let html = '';
  const at: Offer['at'] = {};
  for (const s of segments) {
    if (s.key) at[s.key] = { start: plain.length, end: plain.length + s.text.length, word: s.text };
    let h = escapeHtml(s.text)
      .replace(/ {2,}/g, (m) => ' ' + '&nbsp;'.repeat(m.length - 1))
      .replace(/(^|\n) /g, '$1&nbsp;')
      .replace(/\n/g, '<br>');
    if (s.fmt === 'bold') h = `<b>${h}</b>`;
    if (s.fmt === 'link') h = `<a href="https://example.com/oferta">${h}</a>`;
    if (s.fmt === 'colour') h = `<span style="color:#c00000">${h}</span>`;
    plain += s.text;
    html += h;
  }
  return { plain, html: `<meta charset="utf-8"><div style="font-family:Calibri">${html}</div>`, at };
}

/**
 * The words of `text` (runs of letters) that the dictionary oracle does not hold, other than `allowed` —
 * the test's own proof that its offer carries no misspelling it did not place. Never consults the product.
 */
export function unplacedMisspellings(text: string, allowed: readonly string[]): string[] {
  return (text.match(/\p{L}+/gu) ?? []).filter((w) => !allowed.includes(w) && !isDictionaryWord(w));
}

/** `text` with `word` written over the stretch [start, start + word.length) — same-length replacements. */
export function writeAt(text: string, start: number, word: string): string {
  return text.slice(0, start) + word + text.slice(start + word.length);
}

/**
 * A journey's control: with the checker page open and empty, puts `offer` on the clipboard, pastes it
 * into the box (the writer's paste), waits until the box shows exactly `offer.plain`, presses the check
 * button, and returns the status of the page's own check request and the text that request carried
 * (D-020's {"text": …}) — the setup working and the check path reached, whatever the answer holds.
 */
export async function pasteAndSendCheck(page: Page, offer: Offer): Promise<{ status: number; sent: unknown }> {
  await putOnClipboard(page, offer);
  await pasteIntoOffer(page);
  await expect.poll(() => readOfferText(page), { message: 'the pasted offer shows in the box exactly as copied', timeout: WAIT_MS }).toBe(offer.plain);
  const sentRequest = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === CHECK_PATH, { timeout: 30_000 });
  const { status } = await pressCheck(page);
  const req = await sentRequest;
  let sent: unknown;
  try {
    sent = (req.postDataJSON() as { text?: unknown } | null)?.text;
  } catch {
    sent = undefined;
  }
  return { status, sent };
}
