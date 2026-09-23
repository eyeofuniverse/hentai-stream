/**
 * Run a site scraper: pull episode embed links and attach them to matched
 * series. Talks straight to the DB (no Next server). Meant for a US runner.
 *
 *   npm run scrape -- --site=watchhentai --mode=crawl --limit=30 --dry-run
 *   npm run scrape -- --site=watchhentai --mode=crawl
 *   npm run scrape -- --site=watchhentai --mode=topup --limit=200
 *   npm run scrape -- --site=watchhentai --mode=repair --limit=150
 *
 *   # topup/repair only: try more than one site per series, in order —
 *   # moves to the next site only if the previous one didn't finish the job
 *   npm run scrape -- --site=watchhentai,hentaigasm,miohentai --mode=topup --limit=200
 *
 * modes: crawl (whole site, single site only) |
 *        topup (our series with no video) |
 *        repair (re-fetch episodes whose only sources went DEAD)
 * --site a,b,c : comma-separated fallback chain for topup/repair (crawl uses
 *                only the first one)
 * --dry-run    : match + report, write nothing
 * --limit N    : stop after N episode records (crawl) / N target series (topup/repair)
 * --gap N      : ms between requests to the site (default 1500)
 * --no-create  : don't create bare series for titles missing from catalogue+MAL
 *                (crawl auto-creates by default; MAL search always runs)
 */
import { runScrape } from "@/lib/scraper/run";
import { recountTaxonomy } from "@/lib/metadata/importer";
import { prisma } from "@/lib/db";
import { flushPendingPromotes } from "@/lib/social/post";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, v] = hit.split("=");
  return v ?? "true";
};

const siteArg = flag("site");
const mode = (flag("mode") ?? "crawl") as "crawl" | "topup" | "repair";
if (!siteArg) {
  console.error("--site is required (watchhentai | hentaigasm | miohentai | hentaila)");
  process.exit(1);
}
const siteList = siteArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const summary = await runScrape({
  site: siteList[0],
  sites: siteList,
  mode,
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  dryRun: !!flag("dry-run"),
  refetch: !!flag("refetch"),
  publishLive: !!flag("publish-live"),
  create: flag("no-create") ? false : undefined,
  minGapMs: flag("gap") ? Number(flag("gap")) : undefined,
  log: (m) => console.log(m),
});

if (!flag("dry-run")) {
  await recountTaxonomy().catch((e) => console.error("recount:", e));
}

console.log("\n── done ──");
console.log(JSON.stringify(summary, null, 2));

// see scripts/verify.mts — autoPromoteOnPublish is fire-and-forget by
// design; this waits for any still-in-flight social posts so process.exit()
// below doesn't kill them before Bluesky ever gets the request.
await flushPendingPromotes();

await prisma.$disconnect();
process.exit(summary.errors.length ? 1 : 0);
