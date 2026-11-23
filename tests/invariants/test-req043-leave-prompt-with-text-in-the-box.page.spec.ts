// Purpose: ROW-128 (REQ-043) — leaving or reloading the checker page with text in the box asks for
// confirmation, in every browser of the harness (none of them is Safari on iPhone, the named
// exception), with nothing stored in the browser; an empty box leaves without a prompt.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch suggestions); the typed
// offer carries a fresh marker per run; the prompt is observed as the engine reports it.
//
// Test argument
// ROW-128 promise: leaving or reloading the page with text in the box asks for confirmation in every
//   browser but Safari on iPhone, with nothing stored; an empty box leaves without a prompt (REQ-043
//   fail-if: no confirmation outside Safari on iPhone, an empty box asking, or anything written to
//   browser storage to support it; A-044, A-052).
// ROW-128 wrong product: no leave-page handler at all (the reload silently loses the offer); or one
//   that always asks, empty box included; or one that saves the draft to localStorage instead.
// ROW-128 given: the checker page with the writer's own input (a tap or click in the box and typed
//   keys, so the browser grants the page a leave prompt); when: the box is emptied and the page
//   reloaded; then text with a fresh marker is typed and the page is reloaded; then text is typed and
//   the writer navigates away; then text is typed and the tab is closed; then: the empty box's reload
//   raised no prompt; each leave with text raised exactly one leave-page prompt (`beforeunload`); and
//   with text in the box, localStorage, sessionStorage, cookies and IndexedDB hold nothing and no
//   stored value carries the marker.
// ROW-128 controls: a scratch page with its own leave handler, given the same input and reloaded,
//   raises the prompt — the engine door sees leave prompts in this engine; untouched by the product.
// ROW-128 technique: before/after on the prompt count around each leave, the storage read whole.
// cases: ROW-128 target=ROW-128-leaving-or-reloading-with-text-asks-to-confirm-an-empty-box-does-not-and-nothing-is-stored control=ROW-128-control-the-engine-reports-a-leave-prompt

import { expect, test, type Page } from '@playwright/test';
import { asActor, el, freshMarker, openChecker, ROLES } from './harness';
import { isTouch } from './suggestions-helpers';

async function writerTypes(page: Page, s: string): Promise<void> {
  const box = el(page, ROLES.offer).first();
  if (await isTouch(page)) await box.tap();
  else await box.click();
  await page.keyboard.press('ControlOrMeta+A');
  if (s === '') await page.keyboard.press('Delete');
  else await page.keyboard.type(s);
}

async function stored(page: Page, marker: string) {
  const inPage = await page.evaluate(async (m) => {
    const all: string[] = [];
    for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) all.push(`${s.key(i)}=${s.getItem(s.key(i) ?? '')}`);
    let dbs: string[] = [];
    try {
      dbs = ((await indexedDB.databases?.()) ?? []).map((d) => d.name ?? '?');
    } catch {
      /* the engine cannot list them */
    }
    return { local: localStorage.length, session: sessionStorage.length, dbs, marked: all.filter((x) => x.includes(m)), cookie: document.cookie };
  }, marker);
  const cookies = await page.context().cookies();
  return { ...inPage, cookies: cookies.map((c) => c.name) };
}

test('ROW-128-leaving-or-reloading-with-text-asks-to-confirm-an-empty-box-does-not-and-nothing-is-stored', async ({ page }) => {
  asActor('anonymous');
  const prompts: string[] = [];
  page.on('dialog', (d) => {
    prompts.push(d.type());
    void d.accept();
  });
  const leaveCount = () => prompts.filter((t) => t === 'beforeunload').length;

  await openChecker(page);
  await writerTypes(page, 'a');
  await writerTypes(page, '');
  let n = leaveCount();
  await page.reload({ waitUntil: 'load' });
  expect(leaveCount() - n, 'ROW-128: reloading with an empty box raises no prompt').toBe(0);

  await openChecker(page);
  const marker = freshMarker();
  await writerTypes(page, `Buscamos persona ${marker}`);
  expect(await stored(page, marker), 'ROW-128: with text in the box nothing is stored in the browser').toEqual({ local: 0, session: 0, dbs: [], marked: [], cookie: '', cookies: [] });
  n = leaveCount();
  await page.reload({ waitUntil: 'load' });
  expect(leaveCount() - n, 'ROW-128: reloading with text in the box asks for confirmation').toBe(1);

  await openChecker(page);
  await writerTypes(page, 'Buscamos persona para el equipo');
  n = leaveCount();
  await page.goto('about:blank');
  expect(leaveCount() - n, 'ROW-128: leaving for another page with text in the box asks for confirmation').toBe(1);

  await openChecker(page);
  await writerTypes(page, 'Ofrecemos contrato');
  n = leaveCount();
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => leaveCount() - n, { message: 'ROW-128: closing the tab with text in the box asks for confirmation', timeout: 10_000 }).toBe(1);
});

test('ROW-128-control-the-engine-reports-a-leave-prompt', async ({ context }) => {
  asActor('anonymous');
  const s = await context.newPage();
  const prompts: string[] = [];
  s.on('dialog', (d) => {
    prompts.push(d.type());
    void d.accept();
  });
  await s.setContent('<!doctype html><textarea id="t"></textarea><script>addEventListener("beforeunload", (e) => { e.preventDefault(); e.returnValue = ""; });</script>');
  if (await isTouch(s)) await s.locator('#t').tap();
  else await s.locator('#t').click();
  await s.keyboard.type('texto');
  await s.close({ runBeforeUnload: true });
  await expect.poll(() => prompts.filter((t) => t === 'beforeunload').length, { message: 'ROW-128 control: the engine reports a page\'s leave prompt', timeout: 10_000 }).toBe(1);
});
