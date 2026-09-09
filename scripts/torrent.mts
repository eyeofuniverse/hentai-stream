/**
 * Grab missing episodes from sukebei.nyaa.si, upload to Bunny, and hold them in
 * the review queue for a moderator to approve.
 *
 *   npm run torrent -- --series=<slug>
 *   npm run torrent -- --wanted --limit=5
 *   npm run torrent -- --wanted --limit=3 --dry-run
 *
 * --series SLUG    grab one specific series
 * --wanted         pick from series that have episodes with no working playback
 * --limit N        how many series (default 5)
 * --dry-run        search + rank + report, download nothing
 * --min-seeders N  skip torrents below this (default 2)
 * --max-size G     skip torrents bigger than this in GiB (default 8)
 * --dir PATH       download scratch dir (default ./.torrents)
 * --no-review      publish grabbed episodes once Bunny transcodes them, instead
 *                  of holding them in /admin/review
 *
 * Needs `aria2c` on PATH.
 */
import { runTorrentGrab } from "@/lib/torrent/run";
import { prisma } from "@/lib/db";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const hit = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return undefined;
  return hit.split("=")[1] ?? "true";
};

const summary = await runTorrentGrab({
  seriesSlug: flag("series"),
  wanted: !!flag("wanted"),
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  dryRun: !!flag("dry-run"),
  minSeeders: flag("min-seeders") ? Number(flag("min-seeders")) : undefined,
  maxSizeGb: flag("max-size") ? Number(flag("max-size")) : undefined,
  review: flag("no-review") ? false : undefined,
  downloadDir: flag("dir") ?? "./.torrents",
  log: (m) => console.log(m),
});

console.log("\n── done ──");
console.log(
  JSON.stringify(
    { ...summary, gbDown: +(summary.bytesDown / 1024 ** 3).toFixed(2) },
    null,
    2,
  ),
);

await prisma.$disconnect();
process.exit(summary.errors.length ? 1 : 0);
