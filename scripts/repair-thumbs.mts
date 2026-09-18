/**
 * Repairs a bounded batch of dead episode thumbnails per run — re-copies
 * from Bunny's own generated thumbnail (reliable; it's the source, not a
 * hotlink) into R2, via the existing copyBunnyThumbToR2.
 *
 * Found live 2026-09-18: 21.8% of ready episodes (550/2521) had a thumbnail
 * that 404s from R2 despite Bunny itself still serving it fine — root cause
 * not confirmed (an old migration gap, a since-fixed upload bug, R2 objects
 * lost at some point — no evidence points to any one of these over another).
 * The fix (re-copy from Bunny) works, but Bunny's own CDN has a rate limit
 * on this specific asset (428 "Precondition Required") that a large batch
 * trips even at 2s between requests — the exact window is unconfirmed, so
 * this deliberately stays small and runs nightly rather than as one big
 * sweep, to work through the backlog without ever tripping it.
 *
 *   npm run repair-thumbs                # default batch (see BATCH below)
 *   npm run repair-thumbs -- --limit=50
 */
import { prisma, db } from "@/lib/db";
import { copyBunnyThumbToR2 } from "@/lib/hosting/migrate";

const BATCH = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 40;
const GAP_MS = 3000;

async function isLive(key: string): Promise<boolean> {
  try {
    const res = await fetch(`https://img-cdn.lusthentai.com/${key}`, {
      method: "HEAD",
      headers: { Referer: process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com/" },
      signal: AbortSignal.timeout(10000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

const episodes = await db(() =>
  prisma.episode.findMany({
    where: { bunnyStatus: "ready", thumbUrl: { not: null } },
    select: { id: true, thumbUrl: true },
    orderBy: { id: "asc" }, // stable order so successive nightly runs sweep forward through the backlog
  }),
);
console.log(`scanning ${episodes.length} ready episodes for dead thumbnails (repairing up to ${BATCH})...`);

let fixed = 0;
let scanned = 0;
for (const ep of episodes) {
  if (fixed >= BATCH) break;
  scanned++;
  if (await isLive(ep.thumbUrl!)) continue;
  await copyBunnyThumbToR2(ep.id);
  fixed++;
  await new Promise((r) => setTimeout(r, GAP_MS));
}

console.log(`done — scanned ${scanned}, attempted repair on ${fixed} (some may still fail if Bunny's limit is still cold from a prior run; next run picks up where liveness checks still find them dead)`);
await prisma.$disconnect();
