import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' });
const boolean = (name: string) => integer(name, { mode: 'boolean' });
const nowMs = sql`(unixepoch() * 1000)`;

export const STATUSES = ['plan', 'watching', 'completed', 'dropped', 'on_hold'] as const;
export type Status = (typeof STATUSES)[number];

export const SHARE_KINDS = ['entry', 'list'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const REACTION_KINDS = ['heart', 'eyes', 'nope'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const animeCache = sqliteTable('anime_cache', {
  malId: integer('mal_id').primaryKey(),
  title: text('title').notNull(),
  titleEnglish: text('title_english'),
  imageUrl: text('image_url').notNull(),
  episodes: integer('episodes'),
  durationMinutes: integer('duration_minutes'),
  genres: text('genres').notNull().default('[]'),
  year: integer('year'),
  meanScore: real('mean_score'),
  synopsis: text('synopsis'),
  cachedAt: timestampMs('cached_at').notNull().default(nowMs),
});

export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    malId: integer('mal_id')
      .notNull()
      .references(() => animeCache.malId),
    status: text('status', { enum: STATUSES }).notNull().default('plan'),
    userScore: integer('user_score'),
    privateNotes: text('private_notes'),
    episodesWatched: integer('episodes_watched').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    addedAt: timestampMs('added_at').notNull().default(nowMs),
    updatedAt: timestampMs('updated_at').notNull().default(nowMs),
    completedAt: timestampMs('completed_at'),
  },
  (t) => [
    uniqueIndex('entries_user_mal_unique').on(t.userId, t.malId),
    index('entries_status_idx').on(t.status),
    index('entries_archived_idx').on(t.archived),
    index('entries_mal_idx').on(t.malId),
    index('entries_user_idx').on(t.userId),
  ],
);

export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestampMs('created_at').notNull().default(nowMs),
    updatedAt: timestampMs('updated_at').notNull().default(nowMs),
  },
  (t) => [index('lists_user_idx').on(t.userId)],
);

export const listEntries = sqliteTable(
  'list_entries',
  {
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    addedAt: timestampMs('added_at').notNull().default(nowMs),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.entryId] }),
    index('list_entries_entry_idx').on(t.entryId),
  ],
);

export const shares = sqliteTable(
  'shares',
  {
    token: text('token').primaryKey(),
    kind: text('kind', { enum: SHARE_KINDS }).notNull(),
    entryId: text('entry_id').references(() => entries.id, { onDelete: 'cascade' }),
    listId: text('list_id').references(() => lists.id, { onDelete: 'cascade' }),
    take: text('take'),
    // Public-render gate for the snapshot's user_score. The snapshot itself
    // still carries the number (immutable), but the creator can hide it from
    // recipients via this flag. Default true preserves v1 behavior.
    includeScore: boolean('include_score').notNull().default(true),
    snapshot: text('snapshot').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestampMs('created_at').notNull().default(nowMs),
    revokedAt: timestampMs('revoked_at'),
  },
  (t) => [
    index('shares_entry_idx').on(t.entryId),
    index('shares_list_idx').on(t.listId),
    check(
      'shares_exactly_one_fk',
      sql`(${t.entryId} IS NOT NULL AND ${t.listId} IS NULL) OR (${t.entryId} IS NULL AND ${t.listId} IS NOT NULL)`,
    ),
  ],
);

export const reactions = sqliteTable(
  'reactions',
  {
    id: text('id').primaryKey(),
    shareToken: text('share_token')
      .notNull()
      .references(() => shares.token, { onDelete: 'cascade' }),
    reactorId: text('reactor_id').notNull(),
    kind: text('kind', { enum: REACTION_KINDS }).notNull(),
    createdAt: timestampMs('created_at').notNull().default(nowMs),
    updatedAt: timestampMs('updated_at').notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('reactions_share_reactor_unique').on(t.shareToken, t.reactorId),
    index('reactions_share_idx').on(t.shareToken),
  ],
);

// One row per (share, viewer). `viewerKey` is the anonymous reactor cookie
// when present, else a salted hash of IP+UA — never a raw IP. The unique index
// makes a refresh a no-op (the beacon upserts `viewedAt`), so the row count is
// the share's unique-viewer total. Owner self-views are not recorded.
export const shareViews = sqliteTable(
  'share_views',
  {
    id: text('id').primaryKey(),
    shareToken: text('share_token')
      .notNull()
      .references(() => shares.token, { onDelete: 'cascade' }),
    viewerKey: text('viewer_key').notNull(),
    firstViewedAt: timestampMs('first_viewed_at').notNull().default(nowMs),
    viewedAt: timestampMs('viewed_at').notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('share_views_share_viewer_unique').on(t.shareToken, t.viewerKey),
    index('share_views_share_idx').on(t.shareToken),
  ],
);

// Opt-in public profile. A user has at most one (userId PK). `handle` is stored
// normalized (lowercase) and unique. Profiles are private until isPublic flips
// to true; /u/<handle> only resolves public ones and only surfaces non-revoked
// shares — so the immutable-snapshot privacy rules carry over unchanged.
export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    bio: text('bio'),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestampMs('created_at').notNull().default(nowMs),
    updatedAt: timestampMs('updated_at').notNull().default(nowMs),
  },
  (t) => [uniqueIndex('profiles_handle_unique').on(t.handle)],
);

export type AnimeCacheRow = typeof animeCache.$inferSelect;
export type EntryRow = typeof entries.$inferSelect;
export type ListRow = typeof lists.$inferSelect;
export type ListEntryRow = typeof listEntries.$inferSelect;
export type ShareRow = typeof shares.$inferSelect;
export type ReactionRow = typeof reactions.$inferSelect;
export type ShareViewRow = typeof shareViews.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
