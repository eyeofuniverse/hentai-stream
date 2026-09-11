/**
 * One-off migration: every series cover/banner, tag cover, and episode
 * thumbnail that's still a raw hotlinked URL (MAL/AniList/scraper sites) gets
 * uploaded into our own Cloudinary account, and the row is updated to store
 * the resulting public_id instead of the external URL.
 *
 * Naturally resumable — the query for each field is `startsWith('http')`, so
 * anything already migrated (by a prior run, or the pipeline going forward)
 * is automatically excluded. Just run it again if it dies partway through.
 *
 *   npm run backfill:cloudinary
 */
import { prisma, db } from "@/lib/db";
import { uploadRemoteToCloudinary } from "@/lib/cloudinary-upload";

// Kept low deliberately — Supabase's free-tier pooler (10 connections) was
// getting exhausted at 8 concurrent workers each holding a connection for
// both the Cloudinary upload AND the follow-up DB write, causing "Timed out
// fetching a new connection from the pool" and a climbing failure rate.
const CONCURRENCY = 3;

async function migrate<T extends { id: string }>(
  label: string,
  rows: T[],
  rawUrl: (r: T) => string | null,
  folder: string,
  publicId: (r: T) => string,
  save: (id: string, newUrl: string) => Promise<void>,
): Promise<{ ok: number; fail: number }> {
  console.log(`\n=== ${label}: ${rows.length} to migrate ===`);
  let ok = 0;
  let fail = 0;
  const failures: string[] = [];
  const queue = [...rows];

  async function worker() {
    while (queue.length) {
      const r = queue.pop();
      if (!r) return;
      const url = rawUrl(r);
      if (!url) continue;
      const result = await uploadRemoteToCloudinary(url, folder, publicId(r));
      if (result) {
        const saved = await save(r.id, result).then(
          () => true,
          () => false,
        );
        if (saved) ok++;
        else {
          fail++;
          failures.push(r.id);
        }
      } else {
        fail++;
        failures.push(r.id);
      }
      const done = ok + fail;
      if (done % 100 === 0) console.log(`  ${label}: ${done}/${rows.length} (${fail} failed so far)`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`${label}: done — ok=${ok} fail=${fail}`);
  if (failures.length) console.log(`  failed ids (left as-is, raw URL still there): ${failures.slice(0, 20).join(", ")}${failures.length > 20 ? "…" : ""}`);
  return { ok, fail };
}

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice("--limit=".length)) : undefined;

async function main() {
  if (LIMIT) console.log(`(test run — capped at ${LIMIT} rows per field)`);

  const seriesCovers = await db(() =>
    prisma.series.findMany({
      where: { coverUrl: { startsWith: "http" } },
      select: { id: true, slug: true, coverUrl: true },
      take: LIMIT,
    }),
  );
  await migrate(
    "series covers",
    seriesCovers,
    (r) => r.coverUrl,
    "series/covers",
    (r) => r.slug,
    async (id, url) => {
      await db(() => prisma.series.update({ where: { id }, data: { coverUrl: url } }));
    },
  );

  const seriesBanners = await db(() =>
    prisma.series.findMany({
      where: { bannerUrl: { startsWith: "http" } },
      select: { id: true, slug: true, bannerUrl: true },
      take: LIMIT,
    }),
  );
  await migrate(
    "series banners",
    seriesBanners,
    (r) => r.bannerUrl,
    "series/banners",
    (r) => r.slug,
    async (id, url) => {
      await db(() => prisma.series.update({ where: { id }, data: { bannerUrl: url } }));
    },
  );

  const tagCovers = await db(() =>
    prisma.tag.findMany({
      where: { coverUrl: { startsWith: "http" } },
      select: { id: true, slug: true, coverUrl: true },
      take: LIMIT,
    }),
  );
  await migrate(
    "tag covers",
    tagCovers,
    (r) => r.coverUrl,
    "tags/covers",
    (r) => r.slug,
    async (id, url) => {
      await db(() => prisma.tag.update({ where: { id }, data: { coverUrl: url } }));
    },
  );

  const epThumbs = await db(() =>
    prisma.episode.findMany({
      where: { thumbUrl: { startsWith: "http" } },
      select: { id: true, thumbUrl: true },
      take: LIMIT,
    }),
  );
  await migrate(
    "episode thumbnails",
    epThumbs,
    (r) => r.thumbUrl,
    "episodes/thumbs",
    (r) => r.id,
    async (id, url) => {
      await db(() => prisma.episode.update({ where: { id }, data: { thumbUrl: url } }));
    },
  );

  console.log("\nAll done.");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
