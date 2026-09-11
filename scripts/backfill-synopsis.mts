/**
 * One-off backfill: fill in synopsis for published series that don't have
 * one yet, via AniList (re-querying by anilistId directly where we already
 * have a match, title-searching for the rest).
 *
 *   npx tsx --env-file=.env scripts/backfill-synopsis.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { Http } from "@/lib/scraper/http";
import { anilist } from "@/lib/enrich/sources/anilist";
import { applyEnrichment } from "@/lib/enrich/apply";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      publish: "PUBLISHED",
      OR: [{ synopsis: null }, { synopsis: "" }],
      metadataSource: { not: "manual" },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      titleEnglish: true,
      titleRomaji: true,
      titleOriginal: true,
      altTitles: true,
      year: true,
      malId: true,
      anilistId: true,
      nhentaiId: true,
      hanimeSlug: true,
      anidbId: true,
    },
  }),
);
console.log(`${targets.length} series missing synopsis`);

const http = new Http(1300);
let filled = 0;
let noMatch = 0;
let matchedNoDesc = 0;
let errors = 0;

for (const [i, t] of targets.entries()) {
  try {
    const res = await anilist.enrich(http, t);
    if (!res.matched) {
      noMatch++;
      console.log(`[${i + 1}/${targets.length}] ? ${t.title} — no AniList match`);
      continue;
    }
    if (!res.series?.synopsis) {
      matchedNoDesc++;
      console.log(`[${i + 1}/${targets.length}] ~ ${t.title} — matched, AniList has no description`);
      continue;
    }
    const a = await applyEnrichment(t.id, "anilist", res);
    if (a.fieldsFilled > 0) filled++;
    console.log(`[${i + 1}/${targets.length}] ✓ ${t.title} — +${a.fieldsFilled} fields`);
  } catch (e) {
    errors++;
    console.log(`[${i + 1}/${targets.length}] ✗ ${t.title} — ${(e as Error).message}`);
  }
}

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, filled, noMatch, matchedNoDesc, errors }, null, 2));
await prisma.$disconnect();
