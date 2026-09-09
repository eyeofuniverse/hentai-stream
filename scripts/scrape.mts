/**
 * Run a site scraper: pull episode embed links and attach them to matched
 * series. Talks straight to the DB (no Next server). Meant for a US runner.
 *
 *   npm run scrape -- --site=watchhentai --mode=crawl --limit=30 --dry-run
 *   npm run scrape -- --site=watchhentai --mode=crawl
 *   npm run scrape -- --site=watchhentai --mode=topup --limit=200
 *
 * --dry-run  : match + report, write nothing
 * --limit N  : stop after N episode records (crawl) / N target series (topup)
 * --gap N    : ms between requests to the site (default 1500)
 */
import { runScrape } from "@/lib/scraper/run";
import { recountTaxonomy } from "@/lib/metadata/importer";
import { prisma } from "@/lib/db";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, v] = hit.split("=");
  return v ?? "true";
};

const site = flag("site");
const mode = (flag("mode") ?? "crawl") as "crawl" | "topup";
if (!site) {
  console.error("--site is required (watchhentai | hentaigasm | miohentai | hentaila)");
  process.exit(1);
}

const summary = await runScrape({
  site,
  mode,
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  dryRun: !!flag("dry-run"),
  refetch: !!flag("refetch"),
  publishLive: !!flag("publish-live"),
  minGapMs: flag("gap") ? Number(flag("gap")) : undefined,
  log: (m) => console.log(m),
});

if (!flag("dry-run")) {
  await recountTaxonomy().catch((e) => console.error("recount:", e));
}

console.log("\n── done ──");
console.log(JSON.stringify(summary, null, 2));

await prisma.$disconnect();
process.exit(summary.errors.length ? 1 : 0);
