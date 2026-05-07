#!/usr/bin/env node
// Reassign all rows currently tied to user_id='me' (or created_by='me' on
// shares) to a real Clerk user id. Idempotent: a second run finds zero
// 'me' rows and exits cleanly.
//
// Required env vars (export, .env file via --env-file, or vercel env pull):
//   DATABASE_URL          libsql://...turso.io  (or file:./local.db for dev)
//   DATABASE_AUTH_TOKEN   the Turso DB auth token (omit for local file:)
//
// Usage:
//   1. Sign in once on your Animeroll deployment so Clerk creates a user.
//   2. Grab your Clerk user id from dashboard.clerk.com → Users → your row,
//      OR run `clerk users list` if you have the Clerk CLI.
//   3. Pull production env locally and run:
//        vercel env pull .env.production --environment=production
//        node --env-file=.env.production scripts/migrate-me-to-user.mjs user_2abc...
//
// Or pass env vars inline:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... \
//     node scripts/migrate-me-to-user.mjs user_2abc...

import { createClient } from '@libsql/client';

const userId = process.argv[2];
if (!userId || !/^user_[A-Za-z0-9]{20,}$/.test(userId)) {
  console.error('Usage: node scripts/migrate-me-to-user.mjs <clerk_user_id>');
  console.error('  user id must look like user_2abc123def456ghi789jkl');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('DATABASE_URL is not set. See header of this script for options.');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function run() {
  console.log(`→ Reassigning 'me' rows to ${userId} on ${url.replace(/authToken=[^&]+/, 'authToken=***')}`);

  const tx = await client.transaction('write');
  try {
    const e = await tx.execute({
      sql: "UPDATE entries SET user_id = ? WHERE user_id = 'me'",
      args: [userId],
    });
    const l = await tx.execute({
      sql: "UPDATE lists SET user_id = ? WHERE user_id = 'me'",
      args: [userId],
    });
    const s = await tx.execute({
      sql: "UPDATE shares SET created_by = ? WHERE created_by = 'me'",
      args: [userId],
    });
    await tx.commit();

    const total = e.rowsAffected + l.rowsAffected + s.rowsAffected;
    console.log(`\n✔ Migration complete (${total} rows total):`);
    console.log(`    entries:  ${e.rowsAffected} reassigned`);
    console.log(`    lists:    ${l.rowsAffected} reassigned`);
    console.log(`    shares:   ${s.rowsAffected} reassigned`);
    if (total === 0) {
      console.log(`\n  (no 'me' rows found — script is idempotent, nothing to do)`);
    }
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

run();
