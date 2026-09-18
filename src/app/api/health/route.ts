import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public healthcheck — point an external uptime monitor (UptimeRobot,
 * BetterStack, etc.) at this. There was previously no alerting of any kind:
 * a failed nightly scrape or a broken Bunny migration was silent until
 * someone happened to open /console. Reports DB reachability plus whether
 * the most recent run of each background job actually succeeded, so a
 * monitor catches "the site is up but the pipeline is silently broken" too,
 * not just "the server is down."
 *
 * 200 = healthy. 503 = DB unreachable, or the latest run of some job failed.
 * Staleness (a job just hasn't run in a while) is reported but not treated
 * as failure — job cadence varies (daily vs weekly) and a monitor can apply
 * its own threshold to `startedAt` if it wants that.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();

  let dbOk = true;
  try {
    await db(() => prisma.$queryRaw`SELECT 1`);
  } catch {
    dbOk = false;
  }

  if (!dbOk) {
    return NextResponse.json({ status: "degraded", db: "error", checkedAt }, { status: 503 });
  }

  const [scrape, host, torrent, enrich] = await Promise.all([
    db(() => prisma.scrapeRun.findFirst({ orderBy: { startedAt: "desc" } })).catch(() => null),
    db(() => prisma.hostRun.findFirst({ orderBy: { startedAt: "desc" } })).catch(() => null),
    db(() => prisma.torrentRun.findFirst({ orderBy: { startedAt: "desc" } })).catch(() => null),
    db(() => prisma.enrichRun.findFirst({ orderBy: { startedAt: "desc" } })).catch(() => null),
  ]);

  const jobs = {
    scrape: scrape && { ok: scrape.ok, startedAt: scrape.startedAt, errors: scrape.errors },
    host: host && { ok: host.ok, startedAt: host.startedAt, errors: host.errors },
    torrent: torrent && { ok: torrent.ok, startedAt: torrent.startedAt, errors: torrent.errors },
    enrich: enrich && { ok: enrich.ok, startedAt: enrich.startedAt, errors: enrich.errors },
  };

  // A run still in flight (finishedAt null) isn't a failure — only a run
  // that actually finished and reported ok:false counts against health.
  const anyJobFailed = [scrape, host, torrent, enrich].some(
    (r) => r && r.finishedAt && !r.ok,
  );

  return NextResponse.json(
    { status: anyJobFailed ? "degraded" : "ok", db: "ok", jobs, checkedAt },
    { status: anyJobFailed ? 503 : 200 },
  );
}
