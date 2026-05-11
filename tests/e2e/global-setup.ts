import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Loads Clerk's testing token cookie shape and asserts the right env vars are
 * present. Runs once before all specs. Without CLERK_SECRET_KEY +
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the env, `clerk.signIn()` calls below
 * would 401 against the testing API.
 */
async function globalSetup(): Promise<void> {
  await clerkSetup();
}

export default globalSetup;
