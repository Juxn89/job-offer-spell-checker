// Purpose: ROW-125 (REQ-001, REQ-002) — on the checker page, in every browser of the harness, the text box
// declares its language as Spanish and turns off the browser's own spellcheck, autocorrect and
// autocapitalisation, before a check and while the check's highlights are shown.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); the misspelling is a
// fresh non-word (harness freshNonWord); the attributes are read from the page's DOM as the browser sees
// them, never from the product's source.
//
// Test argument
// ROW-125 promise: the box declares lang es and turns off the browser's own spellcheck, autocorrect and
//   autocapitalisation (ROW-125, origin domain; REQ-001: the product's highlights are the flags; REQ-002:
//   the count line states the number of highlighted words — a browser's own red squiggles or silent
//   autocorrections would add marks and changes the product never made; A-011: the offers are Spanish).
// ROW-125 wrong product: a plain text box — the browser's spellcheck on by default (squiggles under every
//   correct Spanish word in an English-language browser), autocorrect and autocapitalise on (on a phone the
//   keyboard "fixes" gestion before the checker sees it); or a page that sets the attributes on the box it
//   first shows but draws highlights on a fresh editable copy that carries none of them; or a page
//   declared lang="en".
// ROW-125 given: the checker page with its box (data-element="offer"); when: it is read on arrival, then a
//   text holding a fresh non-word is entered and Revisar ortografía pressed, and once the highlight is
//   drawn it is read again; then: both times the box's language (its own lang, or the nearest declared
//   one it inherits) is Spanish (es or es-*), its spellcheck is off, autocorrect is off, and
//   autocapitalise is off or none (on the box, or the form it belongs to); and after the check every
//   editable element holding a highlight declares the same.
// ROW-125 controls: the control case enters a text and reads it back from the box — the element read is
//   the writer's real text box; the highlight drawn in the target shows the after-check reading is of the
//   checked state, not of a page where nothing happened.
// ROW-125 technique: before/after one exact element's declared state, read in the browser (where the
//   attributes take effect); the after-check reading paired with the drawn highlight keeps the case red
//   until a check really draws.
// cases: ROW-125 target=ROW-125-the-box-declares-spanish-and-turns-off-spellcheck-autocorrect-and-autocapitalise-before-and-after-a-check control=ROW-125-control-the-box-read-is-the-writers-text-box

import { expect, test, type Page } from '@playwright/test';
import {
  asActor,
  enterOffer,
  freshNonWord,
  freshRandom,
  openChecker,
  pressCheck,
  readHighlights,
  type Highlight,
} from './harness';
import { layout, readBox } from './words-helpers';

const WAIT_MS = 15_000;
const DECLARED = { language: 'es', spellcheck: 'off', autocorrect: 'off', autocapitalize: 'off' };

/** What the box — and, after a check, every editable element holding a highlight — declares, as the browser reads it. */
async function declared(page: Page) {
  return page.evaluate(() => {
    const read = (e: HTMLElement) => {
      const lang = (e.closest('[lang]')?.getAttribute('lang') ?? '').toLowerCase().split('-')[0];
      const sc = e.getAttribute('spellcheck');
      const spellcheckOff = e.spellcheck === false || sc === 'false';
      const ac = (e.getAttribute('autocorrect') ?? '').toLowerCase();
      const acIdl = (e as unknown as { autocorrect?: unknown }).autocorrect;
      const autocorrectOff = ac === 'off' || acIdl === false;
      const form = (e as HTMLTextAreaElement).form ?? e.closest('form');
      const cap = (e.getAttribute('autocapitalize') ?? form?.getAttribute('autocapitalize') ?? '').toLowerCase();
      const capIdl = String((e as unknown as { autocapitalize?: unknown }).autocapitalize ?? '').toLowerCase();
      const autocapitalizeOff = cap === 'off' || cap === 'none' || capIdl === 'off' || capIdl === 'none';
      return {
        language: lang,
        spellcheck: spellcheckOff ? 'off' : `on (attribute ${JSON.stringify(sc)})`,
        autocorrect: autocorrectOff ? 'off' : `on (attribute ${JSON.stringify(ac)})`,
        autocapitalize: autocapitalizeOff ? 'off' : `on (attribute ${JSON.stringify(cap)})`,
      };
    };
    const box = document.querySelector('[data-element="offer"]') as HTMLElement | null;
    const editableCopies = new Set<HTMLElement>();
    for (const f of Array.from(document.querySelectorAll('[data-element="flag"]'))) {
      let a: HTMLElement | null = (f as HTMLElement).parentElement;
      while (a && !a.isContentEditable) a = a.parentElement;
      if (a && a !== box) {
        while (a.parentElement && a.parentElement.isContentEditable) a = a.parentElement;
        editableCopies.add(a);
      }
    }
    return { box: box ? read(box) : null, editableCopies: Array.from(editableCopies).map(read) };
  });
}

test('ROW-125-the-box-declares-spanish-and-turns-off-spellcheck-autocorrect-and-autocapitalise-before-and-after-a-check', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  await openChecker(page);
  expect(await declared(page), 'ROW-125: on arrival the box declares Spanish and turns the browser’s spellcheck, autocorrect and autocapitalise off').toEqual({
    box: DECLARED,
    editableCopies: [],
  });

  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: nonWord }]);
  const expected: Highlight[] = items.map((p) => ({ word: p.word, start: p.start, end: p.end, visible: true, marked: true }));
  await enterOffer(page, text);
  expect((await pressCheck(page)).status, "ROW-125: the page's check request is answered").toBe(200);
  await expect
    .poll(() => readHighlights(page, text), { message: `ROW-125: "${nonWord}" is highlighted where it stands (seed ${rng.seed})`, timeout: WAIT_MS })
    .toEqual(expected);
  const after = await declared(page);
  expect(
    { box: after.box, editableCopies: after.editableCopies.filter((c) => JSON.stringify(c) !== JSON.stringify(DECLARED)) },
    'ROW-125: while the highlight is shown, the box and any editable copy holding it still declare Spanish with the browser’s corrections off',
  ).toEqual({ box: DECLARED, editableCopies: [] });
});

test('ROW-125-control-the-box-read-is-the-writers-text-box', async ({ page }) => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text } = layout(rng, [{ word: freshNonWord(rng) }]);
  await openChecker(page);
  await enterOffer(page, text);
  expect(await readBox(page), 'ROW-125 control: the element read as the box holds what the writer entered').toBe(text);
});
