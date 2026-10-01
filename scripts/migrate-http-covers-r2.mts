/**
 * One-time migration: Series.coverUrl/bannerUrl rows still storing a raw
 * external URL. enrich/apply.ts's uploadRemoteToR2 call falls back to the
 * source URL whenever the R2 upload fails (`?? s.coverUrl`), with nothing to
 * retry it later — so a transient failure at ingest time leaves that series
 * permanently serving an unoptimized original straight from AniList/MAL's
 * own CDN instead of our resized/webp R2 copy. PageSpeed flagged these as
 * the single biggest image-weight opportunity on the site (100-150KB each on
 * a handful of covers, no resize/format pass at all).
 *
 * Re-runs the exact same upload path normal ingest uses (uploadRemoteToR2 ->
 * putR2FromUrl's sharp resize+webp pass), now that whatever caused the
 * original failure is presumably long past, and writes the resulting R2 key
 * back onto the row — unlike recover-images-r2.mts/reoptimize-images-r2.mts,
 * which only ever re-populate a key the DB already holds.
 *
 *   npx tsx --env-file=.env scripts/migrate-http-covers-r2.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { uploadRemoteToR2 } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      OR: [{ coverUrl: { startsWith: "http" } }, { bannerUrl: { startsWith: "http" } }],
    },
    orderBy: [{ publish: "asc" }, { updatedAt: "desc" }], // PUBLISHED sorts before DRAFT
    take: limit,
    select: { id: true, slug: true, title: true, coverUrl: true, bannerUrl: true },
  }),
);
console.log(`${targets.length} series have a raw external cover/banner URL`);

let coverOk = 0,
  coverFail = 0,
  bannerOk = 0,
  bannerFail = 0;
const CONCURRENCY = 6;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const t = targets[idx];
    const data: { coverUrl?: string; bannerUrl?: string } = {};

    if (t.coverUrl?.startsWith("http")) {
      const key = await uploadRemoteToR2(t.coverUrl, "series/covers", t.slug);
      if (key) {
        data.coverUrl = key;
        coverOk++;
      } else coverFail++;
    }
    if (t.bannerUrl?.startsWith("http")) {
      const key = await uploadRemoteToR2(t.bannerUrl, "series/banners", t.slug);
      if (key) {
        data.bannerUrl = key;
        bannerOk++;
      } else bannerFail++;
    }

    if (Object.keys(data).length) {
      await db(() => prisma.series.update({ where: { id: t.id }, data })).catch(() => {});
    }
    if ((idx + 1) % 25 === 0)
      console.log(
        `[${idx + 1}/${targets.length}] coverOk=${coverOk} coverFail=${coverFail} bannerOk=${bannerOk} bannerFail=${bannerFail}`,
      );
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, coverOk, coverFail, bannerOk, bannerFail }, null, 2));
await prisma.$disconnect();
