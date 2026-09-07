# hentai-stream

Anime-streaming-style hentai site. Video is **not** hosted here — episodes are
embed links to third-party file hosts (StreamTape, DoodStream, …). All titles,
episodes, taxonomy, SEO and series/episode structure live in our database.

## Stack

- **Next.js 15** (App Router) · TypeScript
- **Supabase** — Postgres + Auth (`@supabase/ssr`)
- **Prisma** — ORM (transaction pooler at runtime, direct connection for migrations)
- **Cloudinary** — thumbnails / images
- Cloudflare in front (planned)

## Setup

```bash
npm install
cp .env.example .env      # fill in Supabase, Cloudinary, MAL, CRON_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

## Metadata

Catalogue metadata comes from the MyAnimeList API.

```bash
npm run metadata:backfill            # full catalogue, resumable, DB-direct
npm run metadata:backfill -- 2000 2010
```

A weekly GitHub Action (`.github/workflows/metadata-sync.yml`) re-checks the
current window of seasons for new releases — needs repo secrets `SITE_URL` and
`CRON_SECRET`.

## Env vars

See [`.env.example`](.env.example) for the full list. On the host, set the same
keys; `NEXT_PUBLIC_SITE_URL` must be the deployed URL.
