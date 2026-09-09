/**
 * Weekly "latest releases" MAL sync — the previous, current and next anime
 * season, straight against the DB (no Next server, no SITE_URL, no 300s
 * serverless cap). Mirrors GET /api/cron/metadata?mode=weekly.
 *
 *   npm run metadata:sync              # prev + current + next season
 *   npm run metadata:sync -- --back=3  # also walk 3 extra seasons back (gap-fill)
 *
 * Idempotent: every title is an upsert. Safe to run any time.
 */
import { importSeason, recountTaxonomy, emptyImportStats } from "@/lib/metadata/importer";
import { malEnabled, type MalSeason } from "@/lib/metadata/mal";
import { prisma } from "@/lib/db";

const SEASONS: MalSeason[] = ["winter", "spring", "summer", "fall"];
const back = Number(process.argv.find((a) => a.startsWith("--back="))?.split("=")[1]) || 0;

function shift(y: number, s: MalSeason, by: number) {
  let i = SEASONS.indexOf(s) + by;
  let year = y;
  while (i < 0) { i += 4; year--; }
  while (i > 3) { i -= 4; year++; }
  return { year, season: SEASONS[i] };
}

if (!malEnabled()) {
  console.error("MAL_CLIENT_ID not set");
  process.exit(1);
}

const now = new Date();
const cur = { year: now.getFullYear(), season: SEASONS[Math.floor(now.getMonth() / 3)] };

const targets = [
  ...Array.from({ length: back }, (_, k) => shift(cur.year, cur.season, -(k + 2))),
  shift(cur.year, cur.season, -1),
  cur,
  shift(cur.year, cur.season, 1),
];

const stats = emptyImportStats();
for (const t of targets) {
  console.log(`→ ${t.year} ${t.season}`);
  await importSeason(t.year, t.season, stats);
}

await recountTaxonomy().catch((e) => stats.errors.push(`recount: ${(e as Error).message}`));

console.log("\n── done ──");
console.log(
  JSON.stringify(
    { seasons: targets.length, ...stats, errors: stats.errors.slice(0, 25) },
    null,
    2,
  ),
);

await prisma.$disconnect();
process.exit(stats.errors.length > targets.length ? 1 : 0);
