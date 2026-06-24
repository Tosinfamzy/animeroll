# Animeroll

A personal anime watchlist that produces shareable, Letterboxd-style cards.

Track what you're watching, rate it, drop a one-line take, and send a friend a public link with a real OG preview. No accounts, no walled garden — the social mechanic is the artifact, not a feed.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | Tailwind v4 + shadcn/ui (Base UI primitives) |
| Client data | TanStack Query + Zod |
| Database | Drizzle ORM + libSQL (`file:./local.db` in dev, Turso in prod) |
| Anime metadata | Jikan v4 (no API key) |
| OG images | `next/og` `ImageResponse` |
| Tests | Vitest |

## Quick start

```bash
git clone git@github.com:Tosinfamzy/animeroll.git
cd animeroll
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

Optional: `node scripts/seed.mjs` populates the library with 25 popular shows.

## Features

- Search Jikan and add to your library; in-memory LRU cache for repeat queries
- Status tracking (`plan` / `watching` / `completed` / `dropped` / `on_hold`) with optimistic updates
- Per-entry score (1–10), private notes (never shown on shares), episodes-watched counter
- Filter sidebar: status, length bucket (`<13` / `13–26` / `27+` eps), genre multi-select, year range, min user score
- Curatorial **lists** (separate from status) — create, rename, delete, manage memberships per entry
- **Share loop**: generate a link with an optional one-line take. A snapshot of cover/title/score/status is frozen at share time, so changing your score later doesn't change what the recipient sees
- **Anonymous reactions** on share pages (❤️ / 👀 / 🚫) — mutex per browser, cookie-set reactor IDs, no signup required
- Dynamic OG images via `next/og` — what unfurls in WhatsApp / Slack / Discord
- "Track your own watchlist" CTA on share pages

## Design properties (intentional)

- **Shares are immutable artifacts.** A share captures a snapshot at creation time; updating your score later doesn't change what the recipient sees. To update what a friend sees, generate a new share.
- **Lists and status are orthogonal.** `status='watching'` is progress; lists are curation.
- **Private vs public.** `entries.private_notes` never reaches a share page. `user_score` does.
- **Auth seam reserved.** `lib/auth.ts` exports `getCurrentUserId()` returning `'me'` in v1; swap to a real session id when NextAuth lands and every existing query keeps working.

## Deploying (Vercel + Turso)

1. **Provision Turso:**

   ```bash
   turso db create animeroll
   turso db tokens create animeroll
   turso db show animeroll --url
   ```

2. **Push this repo to GitHub** (already done if you're reading this on github.com).

3. **Import on Vercel** → connect the GitHub repo.

4. **Set Vercel env vars:**
   - `DATABASE_URL=libsql://<your-db>.turso.io`
   - `DATABASE_AUTH_TOKEN=<token from step 1>`
   - `NEXT_PUBLIC_BASE_URL=https://<your-vercel-domain>`

5. **Deploy.** The `prebuild` script runs `drizzle-kit migrate` against Turso before `next build`, so schema is always applied before the new code goes live.

## Production notes

- **Rate limits aren't enforced on Vercel without Upstash.** [`lib/rate-limit.ts`](lib/rate-limit.ts) uses an in-memory token bucket that's fine for `next dev` but a no-op on serverless (each invocation gets fresh memory). Before sharing the URL outside a trusted circle, swap to `@upstash/ratelimit` + `@upstash/redis`. ~30 minutes of work.
- **Jikan rate limits:** 3 req/sec, 60 req/min unauthenticated. The app caches search results in-process and per-anime metadata in `anime_cache` with a 7-day TTL.
- **OG images run on the Node runtime.** `opengraph-image.tsx` files explicitly opt out of Edge so they can use `share-loader.ts` directly. Trade-off is marginally slower cold start; gain is module-environment consistency.

## Project layout

```
/app
  /(app)                 — main library + archive (route group)
  /lists                 — list of lists, list detail
  /share/entry/[token]   — public read-only entry share + OG image
  /share/list/[token]    — public read-only list share + OG image
  /api/anime, /entries, /lists, /shares  — Route Handlers
/components/rolodex      — library UI (cards, filters, detail dialog)
/components/lists        — list UI
/components/share        — share dialog, public views, reaction bar, signup CTA
/lib                     — db, schema, queries, jikan, share-loader, og, rate-limit, filters, types
/drizzle                 — generated migrations
/tests                   — Vitest server-only shim
```

## Tests

```bash
npm run test:run
```

70 unit tests (Vitest) covering filter predicates, rate-limit token-bucket math + store selection, share token generation, snapshot builders, reaction/stats aggregation, AniList import transforms, recommendation ranking, and profile-handle validation. Playwright covers an unauthenticated smoke suite plus an authed share-loop spec. CI (GitHub Actions) runs lint, typecheck, the unit suite, and a production build on every PR; the suite requires Node ≥22 (see `.nvmrc`).

## Intentionally not built

- Friend graphs / follow relationships / activity feeds (the share-link mechanic and opt-in `/u/<handle>` profiles cover discovery without them)
- Collaborative-filtering recommendations (Discover is content-based: taste genres + MAL co-recommendation edges)
- Dynamic OG image for `/u/<handle>` profiles (metadata OG only for now)

These are additive; the data model accommodates each without schema churn.

Since the original cut, the following shipped: MyAnimeList **and** AniList import,
manual list reordering, re-snapshot, a creator-side reaction dashboard with
opt-in view analytics, a stats / year-in-review page, content-based
recommendations, and opt-in public profiles.
