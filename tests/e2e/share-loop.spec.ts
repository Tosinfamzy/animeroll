import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';

/**
 * End-to-end smoke for the share loop:
 *   1. User A (creator) signs in, ensures a known anime is in their library,
 *      creates a share with a unique take.
 *   2. An anonymous reactor visits the share URL and clicks the heart.
 *   3. User B (recipient) signs in in a separate context, opens the share URL,
 *      and clicks "Add to my library".
 *   4. We assert each step in the system that the action is supposed to update.
 *
 * One-time setup (per developer):
 *   - Create two users in Clerk dev (email+password). Use the `+clerk_test`
 *     pattern (e.g. `you+clerk_test_a@example.com`) so they bypass email
 *     verification.
 *   - Put creds in `.env.local` under `E2E_CLERK_USER_{A,B}_{EMAIL,PASSWORD}`.
 *   - `npm run test:e2e -- share-loop.spec.ts` (against a running `npm run dev`).
 *
 * Cleanup: each run leaves a fresh share + reactions + a User-B entry. Revoke
 * via /shares or wipe the test users between runs if state drifts.
 */

interface Creds {
  email: string;
  password: string;
}

const userA: Creds = {
  email: process.env.E2E_CLERK_USER_A_EMAIL ?? '',
  password: process.env.E2E_CLERK_USER_A_PASSWORD ?? '',
};
const userB: Creds = {
  email: process.env.E2E_CLERK_USER_B_EMAIL ?? '',
  password: process.env.E2E_CLERK_USER_B_PASSWORD ?? '',
};

const ALL_PRESENT =
  userA.email !== '' &&
  userA.password !== '' &&
  userB.email !== '' &&
  userB.password !== '';

test.describe('authed share loop', () => {
  test.skip(
    !ALL_PRESENT,
    'set E2E_CLERK_USER_A_EMAIL/PASSWORD and E2E_CLERK_USER_B_EMAIL/PASSWORD to enable',
  );

  // Frieren has stable Jikan metadata + an iconic title. Pick anything you
  // want — this just needs to be a real MAL id with a cover.
  const MAL_ID = 52991;
  const take = `e2e-${Date.now().toString()}`;

  test('creator share → anon reaction → recipient saves to library', async ({ browser }) => {
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    await creatorPage.goto('/');
    await clerk.signIn({
      page: creatorPage,
      signInParams: { strategy: 'password', identifier: userA.email, password: userA.password },
    });
    await creatorPage.goto('/');

    await ensureEntry(creatorPage.request, MAL_ID);

    const createShareRes = await creatorPage.request.post('/api/shares', {
      data: { kind: 'entry', entryId: await findEntryId(creatorPage.request, MAL_ID), take },
    });
    expect(createShareRes.ok()).toBeTruthy();
    const shareBody = (await createShareRes.json()) as {
      data: { token: string; url: string };
    };
    const shareUrl = new URL(shareBody.data.url).pathname;

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await setupClerkTestingToken({ page: anonPage });
    await anonPage.goto(shareUrl);
    await expect(anonPage.getByRole('blockquote')).toContainText(take);

    const heartButton = anonPage.getByRole('button', { name: 'Loved this' });
    await expect(heartButton).toContainText('0');
    await heartButton.click();
    // Optimistic + server reconciled. Bumps 0 → 1.
    await expect(heartButton).toContainText('1', { timeout: 5000 });

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    await recipientPage.goto('/');
    await clerk.signIn({
      page: recipientPage,
      signInParams: { strategy: 'password', identifier: userB.email, password: userB.password },
    });
    await recipientPage.goto(shareUrl);

    const saveButton = recipientPage.getByRole('button', { name: /add to my library/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await expect(recipientPage.getByText(/added to your library|already/i)).toBeVisible({
      timeout: 5000,
    });

    const recipientEntries = await recipientPage.request.get('/api/entries');
    expect(recipientEntries.ok()).toBeTruthy();
    const list = (await recipientEntries.json()) as {
      data: { entry: { malId: number } }[];
    };
    expect(list.data.some((r) => r.entry.malId === MAL_ID)).toBe(true);

    await cleanup(creatorContext, shareBody.data.token);
    await creatorContext.close();
    await anonContext.close();
    await recipientContext.close();
  });
});

async function ensureEntry(request: APIRequestContext, malId: number): Promise<void> {
  const res = await request.post('/api/entries', { data: { malId } });
  // 201 = created, 200 = already existed. 409 from a race is also fine.
  expect([200, 201, 409]).toContain(res.status());
}

async function findEntryId(request: APIRequestContext, malId: number): Promise<string> {
  const res = await request.get('/api/entries');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { entry: { id: string; malId: number } }[] };
  const row = body.data.find((r) => r.entry.malId === malId);
  if (!row) throw new Error(`entry for malId=${String(malId)} not found`);
  return row.entry.id;
}

async function cleanup(context: BrowserContext, token: string): Promise<void> {
  await context.request.post(`/api/shares/${token}/revoke`);
}
