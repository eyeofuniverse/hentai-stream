/**
 * One-time backfill: populate Series.releaseDate (a real calendar date) for
 * existing series, which never had it captured before now — the calendar
 * page was falling back to Episode.createdAt (our own ingestion date) for
 * the ~99.8% of episodes with no airedAt, which is wrong: it showed "when
 * we scraped it" mislabeled as "when it released". Re-queries AniList
 * (preferred — gives a real y/m/d) then MAL (fallback) using the
 * anilistId/malId already on each row.
 *
 *   npx tsx --env-file=.env scripts/backfill-release-dates.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { Http } from "@/lib/scraper/http";
import { getAnime } from "@/lib/metadata/mal";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      releaseDate: null,
      metadataSource: { not: "manual" },
      OR: [{ anilistId: { not: null } }, { malId: { not: null } }],
    },
    orderBy: { publish: "asc" }, // PUBLISHED first — those are what the calendar shows
    take: limit,
    select: { id: true, title: true, anilistId: true, malId: true, publish: true },
  }),
);
console.log(`${targets.length} series need a release date (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`);

const http = new Http(1300);
let ok = 0, noSource = 0, fail = 0;

const MEDIA = `query ($v: Int) { Media(id: $v, type: ANIME) { startDate { year month day } } }`;

function fullDate(d: { year: number | null; month: number | null; day: number | null } | null | undefined): Date | null {
  if (!d?.year || !d.month || !d.day) return null;
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day));
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function parseMalFullDate(d?: string): Date | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

for (const [i, t] of targets.entries()) {
  let releaseDate: Date | null = null;
  try {
    if (t.anilistId) {
      const r = await http.postJson<{ data?: { Media?: { startDate?: { year: number | null; month: number | null; day: number | null } } } }>(
        "https://graphql.anilist.co",
        { query: MEDIA, variables: { v: t.anilistId } },
        { origin: "https://anilist.co", referer: "https://anilist.co/" },
      );
      releaseDate = fullDate(r.data?.Media?.startDate);
    }
    if (!releaseDate && t.malId) {
      const a = await getAnime(t.malId);
      releaseDate = parseMalFullDate(a.start_date);
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (e) {
    fail++;
    console.log(`[${i + 1}/${targets.length}] ✗ ${t.title} — ${(e as Error).message}`);
    continue;
  }

  if (!releaseDate) {
    noSource++;
    console.log(`[${i + 1}/${targets.length}] ? ${t.title} — no full date from either source`);
    continue;
  }

  await db(() => prisma.series.update({ where: { id: t.id }, data: { releaseDate } }));
  ok++;
  console.log(`[${i + 1}/${targets.length}] ✓ ${t.title} — ${releaseDate.toISOString().slice(0, 10)}`);
}

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, ok, noSource, fail }, null, 2));
await prisma.$disconnect();
