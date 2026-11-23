// Purpose: strength fixture — the function grain: ROW-901's test asserts only existence, ROW-902's sits beside it
import { test, expect } from '@playwright/test';

test('ROW-901 the result panel appears', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button').click();
  await expect(page.locator('[data-element="count"]')).toBeVisible();
  await expect(page.locator('mark')).not.toHaveCount(0);
});

test('ROW-902 the flagged words are the misspelt ones', async ({ request }) => {
  const res = await request.post('/api/check', { data: { text: 'gestion' } });
  const body = await res.json();
  expect(body.flags.map((f: { word: string }) => f.word)).toEqual(['gestion']);
});
