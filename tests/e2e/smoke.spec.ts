import { expect, test } from '@playwright/test';

/**
 * Local smoke for routes that don't require a Clerk session. The full authed
 * share/save loop (creator → reactor → recipient) is deferred until we wire
 * `@clerk/testing` tokens into CI. These cases catch the regressions that
 * would actually surface to a recipient: landing renders, sign-in renders,
 * not-found pages render with the right copy, public share URLs resolve.
 */

test('marketing landing renders for unauthed visitor', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/animeroll/i);
  await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
});

test('sign-in page renders the Clerk widget', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('body')).toContainText(/sign in/i);
});

test('unknown share-entry token shows the share-specific not-found page', async ({ page }) => {
  const res = await page.goto('/share/entry/does-not-exist-xyz');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /share unavailable/i })).toBeVisible();
});

test('unknown share-list token shows the list-share not-found page', async ({ page }) => {
  const res = await page.goto('/share/list/does-not-exist-xyz');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /list share unavailable/i })).toBeVisible();
});

test('unknown app route shows the default not-found page', async ({ page }) => {
  const res = await page.goto('/this-route-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
});

test.describe('public share URL', () => {
  const token = process.env.E2E_SHARE_TOKEN ?? '';
  test.skip(token === '', 'set E2E_SHARE_TOKEN to a known-good entry share token to enable');

  test('renders cover, take, and reaction bar without auth', async ({ page }) => {
    await page.goto(`/share/entry/${token}`);
    await expect(page.getByRole('img').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /heart|loved/i }).first()).toBeVisible();
  });
});
