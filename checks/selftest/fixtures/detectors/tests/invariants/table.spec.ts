// Purpose: strength fixture — a parameterised test binds every row its table names (v0.9.8 R11)
import { test, expect } from '@playwright/test';

const CASES = [
  { row: 'ROW-903', word: 'tecnico', fixed: 'técnico' },
  { row: 'ROW-904', word: 'gestion', fixed: 'gestión' },
];

for (const c of CASES) {
  test(`${c.row} suggests the accented form of ${c.word}`, async ({ request }) => {
    const res = await request.post('/api/check', { data: { text: c.word } });
    const body = await res.json();
    expect(body.flags[0].suggestions[0]).toBe(c.fixed);
  });
}
