// Purpose: ROW-124 (REQ-005, REQ-014) — on the checker page, in every browser the harness runs, an offer
// carrying soft hyphens, zero-width characters, no-break spaces, a BOM, curly apostrophes and quotes,
// dashes, Word bullets and CRLF line ends gets no highlight on its correct words, none over those
// characters, a highlight exactly on a misspelling beside them, and Copy text hands back the text as it was.
// Provenance: hand-authored from REQ-005, REQ-014, A-017 and A-019; the characters are the ones word
// processors and web pages put into pasted text (U+00AD, U+200B-U+200D, U+2060, U+FEFF, U+00A0, U+202F,
// U+2018/2019, U+201C/201D, U+2011, U+2012-U+2015, Word's U+F0B7 bullet, CR LF); words from the harness
// fillers, the misspelling fresh per run; no expected value comes from the product.
//
// Test argument
// ROW-124 promise: correct words beside or containing these characters are not flagged, no highlight
//   covers them, and Copy text returns them exactly (REQ-005 punctuation never flagged, decomposed and
//   pasted text never turns correct words into false alarms; REQ-014 "line breaks, blank lines, bullet
//   characters and spacing exactly as pasted"; A-019 "Copy text puts exactly the box's current text on
//   the clipboard"; D-028 a highlight is data-element="flag" whose text is the flagged word).
// ROW-124 wrong product: a checker whose word pattern stops at U+00AD or U+200B, flagging "expe" and
//   "riencia"; one that splits at U+00A0 but not at U+202F; a highlighter that wraps the no-break
//   space or the curly quote with the word; or a page that "cleans" the text — dropping soft hyphens,
//   zero-width characters and the BOM, or turning no-break spaces and curly quotes into plain ones —
//   so Copy text hands back a different text than the writer pasted.
// ROW-124 given: one offer of four CRLF lines and a blank line: a BOM opening it, Word bullets
//   (U+F0B7 + tab, •, ◦, ▪, –), correct words containing U+00AD, U+200B, U+200C, U+200D, U+2060 and
//   U+FEFF, words joined by U+00A0, U+202F, em, en, figure and horizontal-bar dashes and U+2011, words
//   in curly quotes, and one fresh misspelling between a no-break space and curly quotes; when: the
//   text is entered in the box, Revisar ortografía is pressed, then Copy text; then: exactly one
//   highlight, on the misspelling's letters at its place, visible and marked — and the copied text is
//   the entered text, character for character (CR LF compared as a line end: a browser text field
//   reports CR LF as LF, so a page cannot hand back the CR; every other character is compared exactly).
// ROW-124 controls: a plain offer (spaces, LF lines) with one fresh misspelling: one highlight at its
//   place, and Copy text returns that text exactly — the highlight reader and the clipboard recorder
//   work in this engine, so the target's verdict is about the characters.
// ROW-124 technique: one text holding every character class the row names, correct words inside and
//   beside each, the decoy misspelling beside the most invisible ones; exact comparison of the whole
//   highlight list and of the whole copied text, in Chromium, WebKit, Firefox and a phone.
// cases: ROW-124 target=ROW-124-invisible-and-typographic-characters-not-flagged-not-highlighted-and-copied-back-exactly control=ROW-124-control-a-plain-offer-is-highlighted-and-copied-back-exactly

import { expect, test, type Page } from '@playwright/test';
import { ROLES, asActor, el, enterOffer, freshNonWord, freshRandom, openChecker, pressCheck, readHighlights } from './harness';
import { requireDictionary } from './names-terms-helpers';

const SHY = '­';
const ZWSP = '​';
const ZWNJ = '‌';
const ZWJ = '‍';
const WJ = '⁠';
const BOM = '﻿';
const NBSP = ' ';
const NNBSP = ' ';
const NBHYPHEN = '‑';
const WORD_BULLET = '';
const INVISIBLE = /[­​-‍⁠﻿]/g;

const inside = (word: string, at: number, c: string) => word.slice(0, at) + c + word.slice(at);

function offerText(nonWord: string): string {
  const CRLF = '\r\n';
  return [
    `${BOM}Buscamos persona para nuestro equipo`,
    `${WORD_BULLET}\t${inside('experiencia', 4, SHY)} en ${inside('desarrollo', 5, ZWSP)} con ${inside('clientes', 3, ZWNJ)}`,
    `•\t${inside('proyectos', 4, ZWJ)} y ${inside('formación', 5, WJ)} del ${inside('equipo', 3, BOM)}`,
    `◦\tjornada${NBSP}completa con${NNBSP}horario flexible y${NBSP}‘${nonWord}’ en la oficina`,
    '',
    `▪\t‘perfil’ y “empresa” — proyectos—clientes, salario – contrato, horario‒flexible, oficina―equipo, teórico${NBHYPHEN}práctico`,
    `–\t«trabajo» y ‘oficina’${CRLF}`,
  ].join(CRLF);
}

/** Makes invisible characters visible in a failure message. */
const shown = (s: string) => s.replace(/[­​-‍⁠﻿  ‑\r\n\t]/g, (c) => `\\u{${c.charCodeAt(0).toString(16).toUpperCase()}}`);

// Records what the page hands the clipboard: navigator.clipboard.writeText/write (when they succeed),
// and a copy event — the text the page sets on it, or the selection copied by default. Installed before
// the page's own script; it changes nothing the page sees.
const CLIPBOARD_RECORDER = () => {
  const w = window as unknown as { __vidClipboard: { via: string; text: string; ok: boolean }[] };
  w.__vidClipboard = [];
  const rec = (via: string, text: string, ok: boolean) => w.__vidClipboard.push({ via, text, ok });
  const cb = navigator.clipboard as Clipboard | undefined;
  if (cb && typeof cb.writeText === 'function') {
    const original = cb.writeText.bind(cb);
    cb.writeText = (t: string) => {
      const p = original(t);
      p.then(() => rec('writeText', String(t), true), () => rec('writeText', String(t), false));
      return p;
    };
  }
  if (cb && typeof cb.write === 'function') {
    const original = cb.write.bind(cb);
    cb.write = (items: ClipboardItems) => {
      const p = original(items);
      const texts = Promise.all(
        Array.from(items)
          .filter((i) => i.types.includes('text/plain'))
          .map((i) => i.getType('text/plain').then((b) => b.text())),
      );
      p.then(
        () => texts.then((ts) => ts.forEach((t) => rec('write', t, true))),
        () => texts.then((ts) => ts.forEach((t) => rec('write', t, false))),
      );
      return p;
    };
  }
  const setByPage = new WeakSet<Event>();
  window.addEventListener(
    'copy',
    (e) => {
      const dt = (e as ClipboardEvent).clipboardData;
      if (!dt) return;
      const original = dt.setData.bind(dt);
      dt.setData = (type: string, data: string) => {
        if (/^text(\/plain)?$/i.test(type)) {
          setByPage.add(e);
          rec('copy-event', String(data), true);
        }
        return original(type, data);
      };
    },
    true,
  );
  window.addEventListener('copy', (e) => {
    if (setByPage.has(e) || e.defaultPrevented) return;
    const a = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
    const text =
      a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.selectionStart !== null && a.selectionEnd !== null
        ? a.value.slice(a.selectionStart, a.selectionEnd)
        : String(window.getSelection() ?? '');
    rec('copy-selection', text, true);
  });
};

async function prepare(page: Page): Promise<void> {
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch {
    /* engines without these permissions: the page's own fallback path is followed instead */
  }
  await page.addInitScript(CLIPBOARD_RECORDER);
}

/** The highlights, each placed relative to the misspelling, in whichever copy of the text the page draws them on. */
async function highlightsAround(page: Page, text: string, nonWord: string) {
  const lf = text.replace(/\r\n/g, '\n');
  const candidates = [text, lf, lf.replace(INVISIBLE, ''), text.replace(INVISIBLE, '')];
  let last: { word: string; fromMisspelling: number; visible: boolean; marked: boolean }[] = [];
  for (const c of candidates) {
    const hs = await readHighlights(page, c);
    last = hs.map((h) => ({ word: shown(h.word), fromMisspelling: h.start < 0 ? NaN : h.start - c.indexOf(nonWord), visible: h.visible, marked: h.marked }));
    if (hs.length > 0 && hs.every((h) => h.start >= 0)) return last;
  }
  return last;
}

/** Presses Copy text the way the device does; follows the page's select-and-press-Ctrl+C fallback when the clipboard refuses. */
async function copyText(page: Page): Promise<string | null> {
  const button = el(page, ROLES.copy).first();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await button.tap({ timeout: 15_000 });
  else await button.click({ timeout: 15_000 });
  const copied = () =>
    page.evaluate(() => {
      const r = (window as unknown as { __vidClipboard: { text: string; ok: boolean }[] }).__vidClipboard.filter((x) => x.ok);
      return r.length ? r[r.length - 1].text : null;
    });
  const recorded = (ms: number) =>
    page
      .waitForFunction(() => (window as unknown as { __vidClipboard: { ok: boolean }[] }).__vidClipboard.some((x) => x.ok), null, { timeout: ms })
      .then(() => true, () => false);
  if (!(await recorded(5_000))) {
    await page.keyboard.press('ControlOrMeta+C');
    await recorded(5_000);
  }
  return copied();
}

async function run(page: Page, text: string, nonWord: string, row: string): Promise<void> {
  await prepare(page);
  await openChecker(page);
  await enterOffer(page, text);
  const { status } = await pressCheck(page);
  expect(status, `${row} setup: the page's check was answered`).toBe(200);

  await expect
    .poll(() => highlightsAround(page, text, nonWord), {
      message: `${row}: exactly one highlight, on ${nonWord} at its own place, visible and marked — none on a correct word or on an invisible or typographic character`,
      timeout: 15_000,
    })
    .toEqual([{ word: nonWord, fromMisspelling: 0, visible: true, marked: true }]);

  const copied = await copyText(page);
  const lf = text.replace(/\r\n/g, '\n');
  const asLineEnds = copied === text ? lf : copied; // CR LF handed back as CR LF or as LF: both are the line end
  expect(asLineEnds === null ? null : shown(asLineEnds), `${row}: Copy text hands back the entered text, every character as it was`).toBe(shown(lf));
}

test('ROW-124-invisible-and-typographic-characters-not-flagged-not-highlighted-and-copied-back-exactly', async ({ page }) => {
  asActor('anonymous');
  requireDictionary(['Buscamos', 'experiencia', 'desarrollo', 'clientes', 'proyectos', 'formación', 'equipo', 'jornada', 'completa', 'horario', 'flexible', 'perfil', 'empresa', 'salario', 'contrato', 'oficina', 'teórico', 'práctico', 'trabajo'], 'ROW-124 correct words');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  await run(page, offerText(nonWord), nonWord, 'ROW-124');
});

test('ROW-124-control-a-plain-offer-is-highlighted-and-copied-back-exactly', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const nonWord = freshNonWord(rng);
  const text = `Buscamos persona para nuestro equipo\n- experiencia en desarrollo con clientes\n- jornada completa con ${nonWord} en la oficina\n`;
  await run(page, text, nonWord, 'ROW-124 control');
});
