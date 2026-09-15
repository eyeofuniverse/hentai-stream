/**
 * One-time backfill: re-process every existing series cover down through the
 * new, smaller upload cap (r2-upload.ts LIMITS.covers, 600w -> 400w). The
 * old cap was sized well past any real display width on the site (cards top
 * out around 170-192px CSS, ~340-384px at 2x retina) — PageSpeed flagged
 * 1MB+ of wasted bytes on a mobile run because of exactly this gap. Sources
 * from each cover's own current R2 URL (not the original external source,
 * which may be stale/gone by now) and re-uploads in place at the same key.
 *
 *   npx tsx --env-file=.env scripts/backfill-shrink-covers.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { img } from "@/lib/cloudinary";
import { putR2FromUrl } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.series.findMany({
    // only real R2 keys — a raw http(s) coverUrl (rare, MAL/AniList direct)
    // isn't this pipeline's concern and has its own fallback already
    where: { coverUrl: { not: null, not: { startsWith: "http" } } },
    orderBy: { publish: "asc" }, // PUBLISHED first — visible on the live site right now
    take: limit,
    select: { id: true, coverUrl: true, publish: true },
  }),
);
console.log(
  `${targets.length} series covers to re-process (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`,
);

let ok = 0;
let fail = 0;
const CONCURRENCY = 8;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const s = targets[idx];
    const currentUrl = img(s.coverUrl);
    // re-upload to the SAME key it already lives at — no DB write needed,
    // this just shrinks the bytes sitting behind the existing coverUrl
    const key = s.coverUrl!;
    if (!currentUrl) {
      fail++;
      continue;
    }
    const done = await putR2FromUrl(key, currentUrl);
    if (done) {
      ok++;
    } else {
      fail++;
    }
    if ((idx + 1) % 100 === 0) console.log(`[${idx + 1}/${targets.length}] ok=${ok} fail=${fail}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, ok, fail }, null, 2));
await prisma.$disconnect();
