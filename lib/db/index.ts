import 'server-only';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Add it to .env (e.g. file:./local.db).');
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

export const db = drizzle(client, { schema });
export { schema };
