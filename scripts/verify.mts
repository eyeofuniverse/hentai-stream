/**
 * Check every video source is actually streamable, set its status, then
 * (re)publish episodes/series that now have a working source.
 *
 *   npm run verify                 # PENDING + stale (>3 days) sources
 *   npm run verify -- --all        # re-check everything
 *   npm run verify -- --limit=500
 *
 * ACTIVE  = plays in a browser on our domain
 * REJECTED = referer/token locked, or X-Frame-blocked (needs a proxy)
 * DEAD    = 404 / not a video
 */
import { runVerify } from "@/lib/verify";
import { prisma } from "@/lib/db";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const h = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return h ? (h.split("=")[1] ?? "true") : undefined;
};

const summary = await runVerify({
  all: !!flag("all"),
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  gapMs: flag("gap") ? Number(flag("gap")) : undefined,
  log: (m) => console.log(m),
});

console.log("\n── done ──");
console.log(JSON.stringify(summary, null, 2));

await prisma.$disconnect();
process.exit(0);
