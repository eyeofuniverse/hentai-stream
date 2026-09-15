/**
 * One-time follow-up to backfill-shrink-covers.mts: that script overwrote
 * each cover's existing R2 key in place with smaller bytes, but Cloudflare
 * caches img-cdn.lusthentai.com with Cache-Control: immutable — confirmed
 * live, it kept serving the old, larger bytes for the same key long after
 * R2's own copy was updated (a 1-year cache with no reason to ever
 * revalidate). Copies every cover to a new key (byte-for-byte, no
 * re-encoding — the source is already the correctly-shrunk webp) and
 * updates coverUrl to point at it, so every visitor gets a guaranteed
 * fresh fetch instead of waiting out the old cache.
 *
 *   npx tsx --env-file=.env scripts/backfill-recache-covers.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { copyR2Object } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

// ".v2" — slugify() (lib/metadata/tags.ts) only ever emits letters/numbers/
// hyphens, so a literal "." can never occur in a real key; unlike a bare
// "-2" suffix (tried first, then reverted — collided with real "season 2"
// titles whose slug already legitimately ends in "-2"), this is unambiguous
// both for skipping already-done rows on a re-run and for spotting them later.
const VERSION_SUFFIX = ".v2";

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      coverUrl: { not: null },
      NOT: [{ coverUrl: { startsWith: "http" } }, { coverUrl: { endsWith: VERSION_SUFFIX } }],
    },
    orderBy: { publish: "asc" }, // PUBLISHED first — visible on the live site right now
    take: limit,
    select: { id: true, coverUrl: true, publish: true },
  }),
);
console.log(
  `${targets.length} series covers to re-key (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`,
);

let ok = 0;
let fail = 0;
const CONCURRENCY = 8;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const s = targets[idx];
    const oldKey = s.coverUrl!;
    const newKey = `${oldKey}${VERSION_SUFFIX}`;
    const done = await copyR2Object(oldKey, newKey);
    if (done) {
      await db(() => prisma.series.update({ where: { id: s.id }, data: { coverUrl: newKey } }));
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
