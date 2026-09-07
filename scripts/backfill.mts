/**
 * Full MyAnimeList hentai backfill — run DIRECTLY against the database, with no
 * Next.js server in the loop (so a dev-server crash can't interrupt it).
 *
 *   npm run metadata:backfill              # 1985 → next year
 *   npm run metadata:backfill -- 2000 2010 # a slice
 *   npm run metadata:backfill -- --fresh   # ignore progress, redo everything
 *
 * Resumable: every finished year is written to scripts/.metadata-backfill-progress.json.
 * If it dies (connection reset, laptop sleep, Ctrl-C), just run it again — it
 * picks up from the first unfinished year. Every DB call already retries
 * transient pooler errors (see src/lib/db.ts).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importSeason, recountTaxonomy, type ImportStats } from "@/lib/metadata/importer";
import { malEnabled, type MalSeason } from "@/lib/metadata/mal";
import { prisma } from "@/lib/db";

const SEASONS: MalSeason[] = ["winter", "spring", "summer", "fall"];
const __dir = dirname(fileURLToPath(import.meta.url));
const PROGRESS = join(__dir, ".metadata-backfill-progress.json");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const pos = args.filter((a) => !a.startsWith("--")).map(Number);

const from = pos[0] || 1985;
const to = pos[1] || new Date().getFullYear() + 1;
const PAUSE_MS = 1500; // between years — ease off the free pooler

if (!malEnabled()) {
  console.error("MAL_CLIENT_ID missing — run via `npm run metadata:backfill` so .env loads");
  process.exit(1);
}

let done = new Set<number>();
if (!flags.has("--fresh") && existsSync(PROGRESS)) {
  try {
    done = new Set(JSON.parse(readFileSync(PROGRESS, "utf8")).done ?? []);
    if (done.size) console.log(`resuming — ${done.size} year(s) already done\n`);
  } catch {
    /* corrupt file — start clean */
  }
}
const saveProgress = () =>
  writeFileSync(PROGRESS, JSON.stringify({ done: [...done].sort((a, b) => a - b) }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const blank = (): ImportStats => ({
  scanned: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  flagged: 0,
  errors: [],
});

const total = blank();
const failedYears: number[] = [];

console.log(`direct backfill ${from}–${to}\n`);

for (let year = from; year <= to; year++) {
  if (done.has(year)) {
    console.log(`  ${year}  ✓ already done`);
    continue;
  }
  process.stdout.write(`  ${year}  … `);
  const t = Date.now();
  const yearStats = blank();
  try {
    for (const season of SEASONS) {
      // importSeason swallows per-title + per-season errors into stats.errors
      await importSeason(year, season, yearStats);
    }
    for (const k of ["scanned", "created", "updated", "skipped", "flagged"] as const) {
      total[k] += yearStats[k];
    }
    total.errors.push(...yearStats.errors);
    done.add(year);
    saveProgress();
    console.log(
      `+${yearStats.created} new, ${yearStats.updated} upd, ${yearStats.skipped} kept, ` +
        `${yearStats.flagged} flagged` +
        `${yearStats.errors.length ? `, ${yearStats.errors.length} item-errors` : ""}` +
        `  (${((Date.now() - t) / 1000) | 0}s)`,
    );
  } catch (e) {
    // only a hard, non-retryable failure lands here
    failedYears.push(year);
    console.log(`\n  ${year}  ✗ ${(e as Error).message}`);
  }
  await sleep(PAUSE_MS);
}

if (failedYears.length === 0) {
  process.stdout.write("\n  recount … ");
  try {
    await recountTaxonomy();
    console.log("done");
  } catch (e) {
    console.log(`FAILED (${(e as Error).message}) — re-run the script to retry`);
  }
} else {
  console.log("\n  skipping recount — re-run to retry failed years first");
}

console.log("\n── done ──");
console.log({
  scanned: total.scanned,
  created: total.created,
  updated: total.updated,
  skipped: total.skipped,
  flagged: total.flagged,
});
if (total.errors.length) {
  console.log(`\n${total.errors.length} per-title error(s); first 30:`);
  for (const e of total.errors.slice(0, 30)) console.log("  · " + e);
}
if (failedYears.length) {
  console.log(`\n⚠ years still failed: ${failedYears.join(", ")} — run the script again.`);
}

await prisma.$disconnect();
process.exit(failedYears.length ? 1 : 0);
