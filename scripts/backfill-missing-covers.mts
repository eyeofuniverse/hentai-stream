/**
 * One-time backfill: 222 published series had coverUrl = null — 98% of them
 * (92/94) tagged "3D", because CGI/3D hentai isn't in MAL/AniList (which only
 * indexes real anime), so the metadata pipeline never had a cover to fetch
 * for them. Every one of them DOES already have a hosted episode thumbnail
 * (episodes/thumbs/<id>, same R2 pipeline img() resolves coverUrl through —
 * verified: img() just prepends the R2 host to whatever key it's given, no
 * folder-specific logic) — use that as the series cover instead of nothing.
 *
 *   npx tsx --env-file=.env scripts/backfill-missing-covers.mts
 */
import { prisma, db } from "@/lib/db";

const targets = await db(() =>
  prisma.series.findMany({
    where: { publish: "PUBLISHED", coverUrl: null },
    select: {
      id: true,
      slug: true,
      episodes: {
        where: { publish: "PUBLISHED" },
        orderBy: { number: "asc" },
        take: 1,
        select: { thumbUrl: true },
      },
    },
  }),
);
console.log(`${targets.length} series missing a cover`);

let ok = 0;
let skip = 0;
for (const s of targets) {
  const thumb = s.episodes[0]?.thumbUrl;
  if (!thumb) {
    skip++;
    continue;
  }
  await db(() => prisma.series.update({ where: { id: s.id }, data: { coverUrl: thumb } }));
  ok++;
}

console.log(`\n── done ──\n${JSON.stringify({ total: targets.length, ok, skip }, null, 2)}`);
await prisma.$disconnect();
