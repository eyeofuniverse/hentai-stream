/**
 * One-time follow-up to recover-images-r2.mts: that script ran before
 * r2-upload.ts gained sharp-based resize/webp compression, so everything it
 * touched is sitting in R2 at full original resolution with no cache header.
 * This re-fetches each object FROM R2 (not the original AniList/MAL source —
 * no need, and no rate limit here), runs it through the same optimize path,
 * and re-uploads in place.
 *
 *   npx tsx --env-file=.env scripts/reoptimize-images-r2.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { putR2FromUrl } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const PUBLIC_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      OR: [
        { AND: [{ coverUrl: { not: null } }, { NOT: { coverUrl: { startsWith: "http" } } }] },
        { AND: [{ bannerUrl: { not: null } }, { NOT: { bannerUrl: { startsWith: "http" } } }] },
      ],
    },
    orderBy: [{ publish: "asc" }, { updatedAt: "desc" }],
    take: limit,
    select: { slug: true, title: true, coverUrl: true, bannerUrl: true },
  }),
);
console.log(`${targets.length} series to re-optimize`);

let ok = 0, fail = 0;
const CONCURRENCY = 6;
let i = 0;

async function worker() {
  while (i < targets.length) {
    const idx = i++;
    const t = targets[idx];
    const keys = [t.coverUrl, t.bannerUrl].filter(
      (k): k is string => !!k && !k.startsWith("http"),
    );
    for (const key of keys) {
      const success = await putR2FromUrl(key, `https://${PUBLIC_HOST}/${key}`);
      if (success) ok++; else fail++;
    }
    if ((idx + 1) % 50 === 0) console.log(`[${idx + 1}/${targets.length}] ok=${ok} fail=${fail}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, ok, fail }, null, 2));
await prisma.$disconnect();
