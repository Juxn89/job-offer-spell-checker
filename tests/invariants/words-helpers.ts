// Purpose: the `words` batch's shared helpers — texts with words placed where a test says (sentence-
// initial or mid-sentence), exact flag comparison, the dictionary's own neighbourhood of a word (to know
// a misspelling's one expected correction), and the page readings the batch's page rows need: the count
// line, the box's text, a suggestion chosen as the writer chooses it, and where each highlight is drawn
// against where its word is drawn in the box.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); it reaches the product
// only through the harness client (tests/invariants/harness.ts) and the page's D-021/D-028 identifiers,
// and its dictionary answers come from the harness's oracle (dictionary-es 4.0.0, pinned) — nothing here
// is produced by, imported from, or read out of the product's source.
//
// What it never does: it never sends a check itself (the doors in harness.ts do, on the shared budget),
// never navigates, and never changes the page's text, styles or state; the alignment reading adds one
// invisible measuring element for the length of one evaluation and removes it.

import { expect, type Locator, type Page } from '@playwright/test';
import {
  byPosition,
  compose,
  el,
  fillerWords,
  isDictionaryWord,
  placeOf,
  ROLES,
  type CheckAnswer,
  type Placed,
  type Rng,
} from './harness';

// ─── Words and texts ─────────────────────────────────────────────────────────────────────────────

/** `w` in capitals, Spanish casing (á → Á, ñ → Ñ, ü → Ü). */
export function upperEs(w: string): string {
  return w.toLocaleUpperCase('es');
}

/** `w` with its first letter capitalised and the rest as written. */
export function titleEs(w: string): string {
  return w.slice(0, 1).toLocaleUpperCase('es') + w.slice(1);
}

/** A word the layout places: `initial` puts it first in its sentence (after ". "), otherwise mid-sentence. */
export type Item = { word: string; initial?: boolean };

/**
 * Builds a text of correct filler words (harness `fillerWords`, all lower-case dictionary words) with each
 * item placed in the order given: an `initial` item opens a sentence (". " before it), any other item
 * stands mid-sentence (after a space or ", ", never first in the text). Between items go `min`..`max`
 * fillers (default 1..2), chosen and counted by `rng`. Returns the text, where each item stands (in the
 * items' order) and where every token stands. Positions are the test's own record, computed before
 * anything is sent.
 */
export function layout(
  rng: Rng,
  items: readonly Item[],
  opts: { min?: number; max?: number } = {},
): { text: string; items: Placed[]; tokens: Placed[] } {
  const fillers = fillerWords();
  const min = opts.min ?? 1;
  const max = opts.max ?? 2;
  const tokens: string[] = [];
  const seps: string[] = [];
  const itemIndex: number[] = [];
  const push = (tok: string, sep: string) => {
    if (tokens.length) seps.push(sep);
    tokens.push(tok);
  };
  const midSep = () => (rng.int(5) === 0 ? ', ' : ' ');
  push(rng.pick(fillers), '');
  for (const item of items) {
    const n = min + rng.int(max - min + 1);
    for (let i = 0; i < n; i++) push(rng.pick(fillers), midSep());
    itemIndex.push(tokens.length);
    push(item.word, item.initial ? '. ' : midSep());
  }
  push(rng.pick(fillers), ' ');
  const { text, placed } = compose(tokens, seps);
  return { text: text + '.', items: itemIndex.map((i) => placed[i]), tokens: placed };
}

const key = (p: Placed) => `${p.start}-${p.end} ${JSON.stringify(p.word)}`;

/**
 * Compares the endpoint's flags with the flags expected, as two lists for one `toEqual`: the expected
 * words not flagged at their place, and every flag that is not an expected one (with the text found at
 * its offsets). A right answer gives `{ notFlagged: [], flaggedWrongly: [] }`. With `within`, only flags
 * overlapping one of those spans are judged (the rest of the text has no expectation).
 */
export function flagDiff(
  text: string,
  answer: CheckAnswer,
  expected: readonly Placed[],
  within?: readonly Placed[],
): { notFlagged: string[]; flaggedWrongly: string[] } {
  const got = byPosition(answer.flagged.map(placeOf));
  const want = new Set(expected.map(key));
  const have = new Set(got.map(key));
  const overlaps = (f: Placed) => !within || within.some((w) => f.start < w.end && w.start < f.end);
  return {
    notFlagged: expected.filter((p) => !have.has(key(p))).map(key),
    flaggedWrongly: got
      .filter((f) => !want.has(key(f)) && overlaps(f))
      .map((f) => `${key(f)} (text there: ${JSON.stringify(text.slice(f.start, f.end))})`),
  };
}

/** The first suggestion the endpoint gave for the flag standing exactly at `p`, or null (not flagged / none). */
export function firstSuggestionAt(answer: CheckAnswer, p: Placed): string | null {
  const f = answer.flagged.find((x) => x.start === p.start && x.end === p.end);
  return f ? (f.suggestions[0] ?? null) : null;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyzáéíóúüñ';

/**
 * Every lower-case word the dictionary oracle holds at one edit from `word` (one letter deleted, inserted,
 * replaced, or two neighbours swapped; accented letters, ñ and ü count as letters). Used to know that a
 * misspelling has exactly one expected correction before a test asserts it comes first.
 */
export function dictionaryNeighbours(word: string): string[] {
  const w = word.toLocaleLowerCase('es');
  const out = new Set<string>();
  const consider = (c: string) => {
    if (c !== w && c.length > 0 && isDictionaryWord(c)) out.add(c);
  };
  for (let i = 0; i < w.length; i++) consider(w.slice(0, i) + w.slice(i + 1));
  for (let i = 0; i + 1 < w.length; i++) consider(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  for (let i = 0; i <= w.length; i++) {
    for (const ch of LETTERS) {
      consider(w.slice(0, i) + ch + w.slice(i));
      if (i < w.length) consider(w.slice(0, i) + ch + w.slice(i + 1));
    }
  }
  return [...out].sort();
}

const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

/** `base` (no acute accent) and every form of it carrying exactly one acute accent on one of its vowels. */
export function singleAccentForms(base: string): string[] {
  const out = [base];
  for (let i = 0; i < base.length; i++) {
    const acc = ACUTE[base[i]];
    if (acc) out.push(base.slice(0, i) + acc + base.slice(i + 1));
  }
  return out;
}

// ─── The count line (REQ-002: data-element="count") ─────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
};

function wordsOf(s: string): string[] {
  return s.toLocaleLowerCase('es').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * The numbers a line states: its numerals (digit groups) when it has any, otherwise its Spanish number
 * words (uno/una/un … quince, cero). "3 palabras marcadas" → [3]; "Una palabra marcada" → [1];
 * "No se encontraron errores de ortografía" → [].
 */
export function numbersStated(s: string): number[] {
  const digits = s.match(/\d+/g);
  if (digits) return digits.map(Number);
  return wordsOf(s).filter((w) => w in NUMBER_WORDS).map((w) => NUMBER_WORDS[w]);
}

/**
 * True when a line says that no spelling errors were found: it carries a negation or a zero (no, sin,
 * ningún/ninguna/ninguno, cero, 0) and names errors (error…, falta…, ortograf…, fallo…), and states no
 * number other than 0. "No se encontraron errores de ortografía" and "Sin errores ortográficos" are;
 * "2 palabras marcadas" is not.
 */
export function statesNoErrors(s: string): boolean {
  const ws = wordsOf(s);
  const negation = ws.some((w) => ['no', 'sin', 'ningún', 'ninguna', 'ninguno', 'cero', '0'].includes(w));
  const errors = ws.some((w) => /^(error|falta|ortogr|fallo)/.test(w));
  return negation && errors && numbersStated(s).every((n) => n === 0);
}

/** The count line as the writer sees it: whether it is visible, its text, the numbers it states, and whether it says no errors. */
export type CountLine = { visible: boolean; text: string; numbers: number[]; noErrors: boolean };

/** Reads the count line (data-element="count", the first one). Absent → not visible, empty text. No waiting. */
export async function readCountLine(page: Page): Promise<CountLine> {
  const line = el(page, ROLES.count).first();
  if ((await el(page, ROLES.count).count()) === 0) return { visible: false, text: '', numbers: [], noErrors: false };
  const visible = await line.isVisible();
  const text = ((await line.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  return { visible, text, numbers: numbersStated(text), noErrors: statesNoErrors(text) };
}

// ─── The box and the writer's operations ─────────────────────────────────────────────────────────

/** The text the box (data-element="offer") holds now: a text field's value, or an editable element's text. */
export async function readBox(page: Page): Promise<string> {
  return el(page, ROLES.offer)
    .first()
    .evaluate((e) => {
      if (e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement) return e.value;
      return (e as HTMLElement).innerText;
    });
}

/** True when the page runs on a touch device (the `phone` project): operations are taps there. */
export async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.maxTouchPoints > 0);
}

/** Operates a control the way the device does: a tap on a touch device, a click otherwise (Playwright's actionability waits apply). */
export async function operate(page: Page, target: Locator): Promise<void> {
  if (await isTouch(page)) await target.tap({ timeout: 15_000 });
  else await target.click({ timeout: 15_000 });
}

/**
 * The highlight (data-element="flag") whose own text is exactly `word` — failing by name unless exactly
 * one visible highlight carries it.
 */
export async function theFlag(page: Page, word: string): Promise<Locator> {
  const all = el(page, ROLES.flag);
  const n = await all.count();
  const matching: number[] = [];
  for (let i = 0; i < n; i++) if ((await all.nth(i).textContent()) === word && (await all.nth(i).isVisible())) matching.push(i);
  expect(matching.length, `exactly one visible highlight reads "${word}"`).toBe(1);
  return all.nth(matching[0]);
}

/**
 * Chooses the suggestion `suggestion` from the open suggestion list, as the writer does: the one visible
 * control whose accessible name (button, option, menu item, link) — or, failing that, whose whole text —
 * is exactly `suggestion`, outside the box and the highlights; failing by name unless exactly one exists.
 * It selects by the suggested word itself (data, not wording), so no identifier is assumed for the list.
 */
export async function chooseSuggestion(page: Page, suggestion: string): Promise<void> {
  const outside = (loc: Locator) =>
    loc
      .filter({ visible: true })
      .and(page.locator(`:not([data-element="${ROLES.flag}"]):not([data-element="${ROLES.offer}"])`));
  const byRole = ['button', 'option', 'menuitem', 'menuitemradio', 'link', 'listitem'] as const;
  let candidates: Locator | null = null;
  for (const role of byRole) {
    const loc = outside(page.getByRole(role, { name: suggestion, exact: true }));
    if ((await loc.count()) > 0) {
      candidates = loc;
      break;
    }
  }
  if (!candidates) candidates = outside(page.getByText(suggestion, { exact: true }));
  await expect(candidates, `the open suggestion list offers "${suggestion}" as one visible choice`).toHaveCount(1, { timeout: 15_000 });
  await operate(page, candidates.first());
}

// ─── Where highlights are drawn (ROW-122) ────────────────────────────────────────────────────────

/** One highlight measured against where its word is drawn in the box. */
export type AlignedFlag = {
  word: string;
  start: number;
  /** The word's own place is inside the part of the box the writer can see (box ∩ viewport). */
  inView: boolean;
  ok: boolean;
  why: string;
};

export type Alignment = {
  /** How the word's own place was measured: a text field's laid-out copy, the box's own text, or the shown copy. */
  reference: 'text-field-layout' | 'box-text' | 'shown-copy' | 'none';
  error: string | null;
  flags: AlignedFlag[];
  /** How many highlights were compared (their words in view). */
  compared: number;
};

/**
 * Measures, in one evaluation, every highlight (data-element="flag") against the place its own word is
 * drawn in the box (data-element="offer") as the writer sees it now:
 *  - a text field (textarea/input): the word's place is measured on a hidden element laid out with the
 *    field's own computed font, spacing, padding, wrapping, width and scroll — the field's text exactly
 *    as the field holds it — removed again before the evaluation returns;
 *  - an editable box holding the text itself: the word's place is a DOM range over the box's own text;
 *  - a box not drawn at all (replaced by a copy): a DOM range over the copy the highlights stand in.
 * A highlight is compared only when its word's place lies inside the part of the box the writer can see
 * (box ∩ viewport); it is `ok` when it is drawn there (a box on screen, not hidden) with its centre within
 * max(4 px, half a character) across and max(3 px, 35 % of the line) down of the word's centre, and its
 * width within max(6 px, 25 %) of the word's. The highlight's own offset is read as the harness reads it
 * (its place inside the nearest element whose text is `text`). No navigation, no waiting.
 */
export async function measureAlignment(page: Page, text: string): Promise<Alignment> {
  return page.evaluate((t: string) => {
    type Box = { left: number; top: number; width: number; height: number };
    const result = (reference: Alignment['reference'], error: string | null, flags: AlignedFlag[]) => ({
      reference,
      error,
      flags,
      compared: flags.filter((f) => f.inView).length,
    });
    const offer = document.querySelector('[data-element="offer"]') as HTMLElement | null;
    if (!offer) return result('none', 'the page has no data-element="offer"', []);
    const trimEnd = (s: string) => s.replace(/[\s​﻿]+$/u, '');
    const noBreaks = t.replace(/\r\n|\r|\n/g, '');
    const back: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] !== '\n' && t[i] !== '\r') back.push(i);
    back.push(t.length);
    const modeOf = (e: Element): 'exact' | 'nobreaks' | null => {
      const tc = e.textContent ?? '';
      if (tc === t || trimEnd(tc) === trimEnd(t)) return 'exact';
      if (noBreaks !== t && (tc === noBreaks || trimEnd(tc) === trimEnd(noBreaks))) return 'nobreaks';
      return null;
    };
    const drawn = (e: Element) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
    };
    const firstRect = (e: Element | Range): Box | null => {
      const rs = e.getClientRects();
      const r = rs.length ? rs[0] : e.getBoundingClientRect();
      return r.width > 0 || r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };
    // where a highlight stands in the text, and the copy it stands in
    const placeOfFlag = (f: HTMLElement): { start: number; copy: HTMLElement | null } => {
      let anc: HTMLElement | null = f.parentElement;
      let mode: 'exact' | 'nobreaks' | null = null;
      while (anc && !(mode = modeOf(anc))) anc = anc.parentElement;
      if (!anc || !mode) return { start: -1, copy: null };
      const walker = document.createTreeWalker(anc, NodeFilter.SHOW_TEXT);
      let off = 0;
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (f.contains(n)) return { start: mode === 'exact' ? off : (back[off] ?? -1), copy: anc };
        off += (n as Text).data.length;
      }
      return { start: -1, copy: anc };
    };
    // a DOM range over [start, end) of the text inside `root`
    const rangeIn = (root: Element, start: number, end: number): Range | null => {
      const mode = modeOf(root);
      if (!mode) return null;
      const toLocal = (p: number) => (mode === 'exact' ? p : p - (t.slice(0, p).match(/\r\n|\r|\n/g)?.length ?? 0));
      const s = toLocal(start);
      const e = toLocal(end);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let off = 0;
      let n: Node | null;
      let started = false;
      while ((n = walker.nextNode())) {
        const len = (n as Text).data.length;
        if (!started && s >= off && s < off + len) {
          range.setStart(n, s - off);
          started = true;
        }
        if (started && e > off && e <= off + len) {
          range.setEnd(n, e - off);
          return range;
        }
        off += len;
      }
      return null;
    };
    const PROPS = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'fontKerning',
      'fontFeatureSettings', 'fontVariationSettings', 'fontOpticalSizing', 'lineHeight', 'letterSpacing',
      'wordSpacing', 'textTransform', 'textIndent', 'textAlign', 'tabSize', 'direction', 'paddingTop',
      'paddingRight', 'paddingBottom', 'paddingLeft', 'whiteSpace', 'overflowWrap', 'wordBreak', 'hyphens',
      'textRendering', 'writingMode', 'textSizeAdjust', 'webkitTextSizeAdjust',
    ];
    const fieldRect = (field: HTMLTextAreaElement | HTMLInputElement, start: number, end: number): Box | null => {
      const cs = getComputedStyle(field);
      const m = document.createElement('div');
      const ms = m.style as unknown as Record<string, string>;
      const cr = cs as unknown as Record<string, string>;
      for (const p of PROPS) if (cr[p] !== undefined) ms[p] = cr[p];
      if (field instanceof HTMLInputElement) m.style.whiteSpace = 'pre';
      const r = field.getBoundingClientRect();
      Object.assign(m.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        boxSizing: 'border-box',
        border: '0',
        margin: '0',
        height: 'auto',
        overflow: 'visible',
        width: `${field.clientWidth}px`,
        left: `${r.left + field.clientLeft - field.scrollLeft}px`,
        top: `${r.top + field.clientTop - field.scrollTop}px`,
      });
      const v = field.value;
      m.appendChild(document.createTextNode(v.slice(0, start)));
      const span = document.createElement('span');
      span.textContent = v.slice(start, end);
      m.appendChild(span);
      m.appendChild(document.createTextNode(v.slice(end) + '​'));
      document.documentElement.appendChild(m);
      const box = firstRect(span);
      m.remove();
      return box;
    };
    const visibleRegion = (e: HTMLElement) => {
      const r = e.getBoundingClientRect();
      const left = r.left + e.clientLeft;
      const top = r.top + e.clientTop;
      return {
        left: Math.max(left, 0),
        top: Math.max(top, 0),
        right: Math.min(left + e.clientWidth, window.innerWidth),
        bottom: Math.min(top + e.clientHeight, window.innerHeight),
      };
    };

    const isField = offer instanceof HTMLTextAreaElement || offer instanceof HTMLInputElement;
    const offerDrawn = drawn(offer);
    if (isField && offerDrawn && (offer as HTMLTextAreaElement).value !== t) {
      return result('text-field-layout', 'the box no longer holds the text that was checked', []);
    }
    const reference: Alignment['reference'] = offerDrawn ? (isField ? 'text-field-layout' : 'box-text') : 'shown-copy';
    const flags: AlignedFlag[] = [];
    for (const node of Array.from(document.querySelectorAll('[data-element="flag"]'))) {
      const f = node as HTMLElement;
      const word = f.textContent ?? '';
      const { start, copy } = placeOfFlag(f);
      if (start < 0) {
        flags.push({ word, start, inView: true, ok: false, why: 'the highlight stands in no copy of the text' });
        continue;
      }
      const end = start + word.length;
      let ref: Box | null = null;
      let viewer: HTMLElement = offer;
      if (reference === 'text-field-layout') ref = fieldRect(offer as HTMLTextAreaElement, start, end);
      else if (reference === 'box-text') {
        const rg = rangeIn(offer, start, end);
        ref = rg ? firstRect(rg) : null;
      } else if (copy) {
        viewer = copy;
        const rg = rangeIn(copy, start, end);
        ref = rg ? firstRect(rg) : null;
      }
      if (!ref) {
        flags.push({ word, start, inView: true, ok: false, why: `the word's own place in the box (${reference}) could not be measured` });
        continue;
      }
      const reg = visibleRegion(viewer);
      const cx = ref.left + ref.width / 2;
      const cy = ref.top + ref.height / 2;
      const inView = cx >= reg.left && cx <= reg.right && cy >= reg.top && cy <= reg.bottom;
      if (!inView) {
        flags.push({ word, start, inView, ok: true, why: 'out of view' });
        continue;
      }
      const fr = firstRect(f);
      if (!fr || !drawn(f)) {
        flags.push({ word, start, inView, ok: false, why: 'its word is in view but the highlight is not drawn' });
        continue;
      }
      const charW = ref.width / Math.max(1, word.length);
      const tolX = Math.max(4, charW / 2);
      const tolY = Math.max(3, ref.height * 0.35);
      const tolW = Math.max(6, ref.width * 0.25);
      const dx = fr.left + fr.width / 2 - cx;
      const dy = fr.top + fr.height / 2 - cy;
      const dw = fr.width - ref.width;
      const ok = Math.abs(dx) <= tolX && Math.abs(dy) <= tolY && Math.abs(dw) <= tolW;
      flags.push({
        word,
        start,
        inView,
        ok,
        why: ok
          ? 'over its word'
          : `drawn ${dx.toFixed(1)} px across, ${dy.toFixed(1)} px down and ${dw.toFixed(1)} px wider than its word (allowed ${tolX.toFixed(1)}, ${tolY.toFixed(1)}, ${tolW.toFixed(1)})`,
      });
    }
    return result(reference, null, flags);
  }, text);
}

/** The alignment reduced to what a test asserts: no error, at least one highlight compared, none misaligned. */
export function alignmentVerdict(a: Alignment): { error: string | null; someHighlightInView: boolean; misaligned: string[] } {
  return {
    error: a.error,
    someHighlightInView: a.compared > 0,
    misaligned: a.flags.filter((f) => !f.ok).map((f) => `"${f.word}" at ${f.start}: ${f.why}`),
  };
}
