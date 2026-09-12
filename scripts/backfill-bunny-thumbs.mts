/**
 * One-time backfill: copy Bunny's own generated thumbnail into R2 for every
 * already-hosted episode, so the site stops hotlinking Bunny's CDN for
 * thumbnails going forward (episodeThumb() in cloudinary.ts already prefers
 * this once thumbUrl is set — new episodes get this automatically from
 * hosting/migrate.ts's copyBunnyThumbToR2, called the moment a video
 * finishes transcoding). This just catches everything hosted before that
 * existed.
 *
 *   npx tsx --env-file=.env scripts/backfill-bunny-thumbs.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { thumbUrl as bunnyThumbUrl } from "@/lib/hosting/bunny";
import { uploadRemoteToR2 } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.episode.findMany({
    where: {
      bunnyStatus: "ready",
      bunnyGuid: { not: null },
      OR: [{ thumbUrl: null }, { thumbUrl: { startsWith: "http" } }],
    },
    orderBy: { publish: "asc" }, // PUBLISHED first — visible on the live site right now
    take: limit,
    select: { id: true, bunnyGuid: true, publish: true, series: { select: { title: true } }, number: true },
  }),
);
console.log(`${targets.length} Bunny-hosted episodes need a thumbnail copied to R2 (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`);

let ok = 0, fail = 0;
const CONCURRENCY = 6;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const ep = targets[idx];
    const key = await uploadRemoteToR2(bunnyThumbUrl(ep.bunnyGuid!), "episodes/thumbs", ep.id);
    if (key) {
      await db(() => prisma.episode.update({ where: { id: ep.id }, data: { thumbUrl: key } }));
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
