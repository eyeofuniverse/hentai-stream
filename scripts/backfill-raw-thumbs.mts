/**
 * One-time backfill: copy any episode's raw hotlinked scrape-source
 * thumbnail (thumbUrl still a bare http(s) URL, e.g. straight from
 * hgasm1.com) into R2. backfill-bunny-thumbs.mts only re-sources episodes
 * that are Bunny-hosted; episodes playable only via a mirror never got
 * touched, so their thumbnail stayed hotlinked from the scrape source
 * forever — no cache control, full-resolution JPEGs at thumbnail display
 * size (flagged directly by PageSpeed). Same uploadRemoteToR2 pipeline
 * (resizes + re-encodes to webp), just sourcing from the existing thumbUrl
 * instead of Bunny's own thumbnail.
 *
 *   npx tsx --env-file=.env scripts/backfill-raw-thumbs.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { uploadRemoteToR2 } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.episode.findMany({
    where: { thumbUrl: { startsWith: "http" } },
    orderBy: { publish: "asc" }, // PUBLISHED first — visible on the live site right now
    take: limit,
    select: { id: true, thumbUrl: true, publish: true },
  }),
);
console.log(
  `${targets.length} episodes still hotlinking a raw scrape thumbnail (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`,
);

let ok = 0;
let fail = 0;
const CONCURRENCY = 6;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const ep = targets[idx];
    const key = await uploadRemoteToR2(ep.thumbUrl!, "episodes/thumbs", ep.id);
    if (key) {
      await db(() => prisma.episode.update({ where: { id: ep.id }, data: { thumbUrl: key } }));
      ok++;
    } else {
      fail++;
    }
    if ((idx + 1) % 50 === 0) console.log(`[${idx + 1}/${targets.length}] ok=${ok} fail=${fail}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, ok, fail }, null, 2));
await prisma.$disconnect();
