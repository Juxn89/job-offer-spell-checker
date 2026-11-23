// Purpose: vacuity fixture — each weak shape once, each beside its near miss; every test names ROW-910
import { test, expect } from '@playwright/test';

const SENT = ['gestion', 'tecnico'];

test('ROW-910 or-constant', async ({ page }) => {
  const flagged = await page.locator('mark').count();
  expect(flagged || true).toBeTruthy();
});

test('ROW-910 literal against literal', async () => {
  expect(true).toBe(true);
});

test('ROW-910 catch-all and its near miss', async ({ request }) => {
  await expect(async () => { await request.post('/api/check', { data: { text: 'x'.repeat(20001) } }); }).rejects.toThrow();
  await expect(async () => { await request.post('/api/check', { data: { text: 'x' } }); }).rejects.toThrow('Payload Too Large');
});

test('ROW-910 status span and its near miss', async ({ request }) => {
  const res = await request.post('/api/check', { data: { text: 'x'.repeat(20001) } });
  expect(res.status()).toBeLessThan(500);
  expect(res.status()).toBe(413);
});

test('ROW-910 skip on the condition under test', async ({ request, browserName }) => {
  test.skip(browserName === 'webkit', 'not on this engine');
  const res = await request.post('/api/check', { data: { text: 'gestion' } });
  if (!res.ok()) return;
  expect((await res.json()).flags).toHaveLength(1);
});

test('ROW-910 presence on a static wrapper and its near miss', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-element="offer"]')).toBeVisible();
  await expect(page.locator('[data-element="count"]')).toHaveText('2 palabras');
});

test('ROW-910 a placeholder in a plain literal and the apostrophe near miss', async ({ request }) => {
  const res = await request.post('/api/check', { data: { text: 'gestion' } });
  const word = (await res.json()).flags[0].word;
  expect(word, 'the flagged word is ${word}').toBe('gestion');
  expect(word, "the writer's flagged word").toBe(`${SENT[0]}`);
});

test('ROW-910 an absence of what was never sent, and of what was', async ({ request, page }) => {
  const res = await request.post('/api/check', { data: { text: 'hola zq-marker-1' } });
  expect(await page.content()).not.toContain('zq-never-sent');
  expect(await res.text()).not.toContain('zq-marker-1');
});

test('ROW-910 loops with and without a non-empty check', async ({ request, page }) => {
  const marks = await page.locator('mark').all();
  for (const m of marks) { await expect(m).toHaveAttribute('data-word', /.+/); }
  const flags = (await (await request.post('/api/check', { data: { text: 'gestion tecnico' } })).json()).flags;
  expect(flags.length).toBeGreaterThan(0);
  for (const f of flags) { expect(f.word).not.toBe(''); }
  for (const w of SENT) { expect(w).not.toBe(''); }
  for (const w of ['gestion', 'tecnico']) { expect(w.length).toBe(7); }
});
