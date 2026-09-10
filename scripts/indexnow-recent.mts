/**
 * Ping IndexNow (Bing/Yandex/etc.) with every series + episode page that
 * changed in the last N hours. Run at the end of the pipeline jobs, which
 * publish content outside Next.js and so never hit the server action that
 * normally does this.
 *
 *   npm run indexnow            # last 26h
 *   npm run indexnow -- --hours=72
 */
import { prisma, db } from "@/lib/db";
import { pingIndexNow } from "@/lib/indexnow";
import { SITE } from "@/lib/seo";

const hours =
  Number(process.argv.find((a) => a.startsWith("--hours="))?.split("=")[1]) || 26;
const since = new Date(Date.now() - hours * 3_600_000);

const series = await db(() =>
  prisma.series.findMany({
    where: {
      publish: "PUBLISHED",
      OR: [{ updatedAt: { gte: since } }, { autoPublishedAt: { gte: since } }],
    },
    select: {
      slug: true,
      updatedAt: true,
      episodes: {
        where: { publish: "PUBLISHED" },
        select: { number: true },
      },
    },
    take: 5000,
  }),
);

const urls = ["/", "/browse", "/calendar"];
for (const s of series) {
  urls.push(`/hentai/${s.slug}`);
  for (const e of s.episodes) urls.push(`/hentai/${s.slug}/${e.number}`);
}

console.log(`IndexNow: ${series.length} changed series, ${urls.length} URLs (host ${SITE})`);
await pingIndexNow(urls);
console.log("pinged.");

await prisma.$disconnect();
