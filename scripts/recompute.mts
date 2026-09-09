/**
 * Nightly derived-metric recompute. None of these are maintained live:
 *   weeklyViews    — sum of EpisodeDailyStat.views over the last 7 days
 *   bayesianRating — shrink the user rating toward the global mean (m = 5);
 *                    falls back to the external (MAL) score when we have no votes
 *   trendingScore  — freshness + views + score + "has a playable copy"; tuned so
 *                    a brand-new, playable series still surfaces on a low-traffic
 *                    site, and real view volume takes over as it grows
 * Non-published series are forced to 0 so they can't leak into any ranking.
 *
 *   npm run recompute
 */
import { prisma, db } from "@/lib/db";
import { recountTaxonomy } from "@/lib/metadata/importer";

const started = Date.now();

await db(() =>
  prisma.$executeRawUnsafe(`
    UPDATE "Series" s SET "weeklyViews" = COALESCE((
      SELECT SUM(d.views)::int
      FROM "Episode" e
      JOIN "EpisodeDailyStat" d ON d."episodeId" = e.id
      WHERE e."seriesId" = s.id AND d.date >= (now() - interval '7 days')
    ), 0)
    WHERE s.publish = 'PUBLISHED';
  `),
);

await db(() =>
  prisma.$executeRawUnsafe(`
    UPDATE "Series" s SET "bayesianRating" =
      CASE WHEN s."ratingCount" > 0 THEN
          (s."ratingCount"::float / (s."ratingCount" + 5)) * s."ratingAvg"
        + (5.0 / (s."ratingCount" + 5)) *
          COALESCE((SELECT AVG("ratingAvg") FROM "Series" WHERE "ratingCount" > 0), 6.0)
      ELSE COALESCE(s."externalScore", 0)
      END
    WHERE s.publish = 'PUBLISHED';
  `),
);

await db(() =>
  prisma.$executeRawUnsafe(`
    UPDATE "Series" s SET "trendingScore" =
        GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - s."updatedAt")) / 3888000) * 30
      + GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - s."createdAt")) / 1296000) * 15
      + LN(s."viewCount" + 1) * 6
      + s."weeklyViews" * 4
      + COALESCE(s."externalScore", 6.0) * 1.5
      + (CASE WHEN EXISTS (
          SELECT 1 FROM "Episode" e
          WHERE e."seriesId" = s.id AND e."bunnyStatus" = 'ready'
        ) THEN 8 ELSE 0 END)
    WHERE s.publish = 'PUBLISHED';
  `),
);

await db(() =>
  prisma.$executeRawUnsafe(`
    UPDATE "Series" SET "trendingScore" = 0, "weeklyViews" = 0
    WHERE publish <> 'PUBLISHED' AND ("trendingScore" <> 0 OR "weeklyViews" <> 0);
  `),
);

await recountTaxonomy().catch((e) => console.error("recount:", e));

const top = await db(() =>
  prisma.series.findMany({
    where: { publish: "PUBLISHED" },
    orderBy: { trendingScore: "desc" },
    take: 10,
    select: { title: true, trendingScore: true, weeklyViews: true, viewCount: true },
  }),
);
console.log("top 10 trending:");
for (const t of top)
  console.log(
    `  ${t.trendingScore.toFixed(1)}  wv=${t.weeklyViews} vc=${t.viewCount}  ${t.title}`,
  );
console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s`);

await prisma.$disconnect();
