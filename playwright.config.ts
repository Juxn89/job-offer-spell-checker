// Purpose: the ledger runner's configuration (D-022): Playwright runs every ledger test in
// tests/invariants/ against the product service over the network — `*.api.spec.ts` once, with no
// browser; `*.page.spec.ts` in Chromium, WebKit and Firefox and once at a phone viewport with touch
// (RULE-014). The per-case limit and the results report come from the harness's command line.

import { defineConfig, devices } from '@playwright/test';

const page = /\.page\.spec\.ts$/;

export default defineConfig({
  testDir: 'tests/invariants',
  // /app is mounted read-only in the tests service: the runner's own files go to /tmp.
  outputDir: process.env.VID_PW_OUTPUT ?? '/tmp/vid-playwright',
  forbidOnly: true,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: process.env.VID_PRODUCT_URL ?? 'http://product.test:8080',
    locale: 'es-ES',
  },
  projects: [
    { name: 'api', testMatch: /\.api\.spec\.ts$/ },
    { name: 'chromium', testMatch: page, use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', testMatch: page, use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', testMatch: page, use: { ...devices['Desktop Firefox'] } },
    { name: 'phone', testMatch: page, use: { ...devices['Pixel 7'] } },
  ],
});
