import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for local E2E smoke. Boots `next dev` (production build is
 * slower and migrates the DB; dev is fine for smoke). Authed flows are not
 * covered yet — they need `@clerk/testing` tokens. The current spec exercises
 * routes that don't require a session: marketing landing, sign-in page,
 * public share page (if E2E_SHARE_TOKEN is set), and the new not-found pages.
 *
 * Not wired into Vercel CI — run locally with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Reuse a running dev server if there is one (faster iteration). CI gets a
  // fresh boot.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
