import { prisma, db } from "@/lib/db";
import { bunnyEnabled, listAllVideos, deleteVideo } from "./bunny";

export interface ReconcileSummary {
  bunnyVideos: number;
  dbHosted: number;
  orphanedDeleted: number;
  orphanedStorageBytesFreed: number;
  failedLinkedCleaned: number;
  tookMs: number;
}

/**
 * Finds and deletes Bunny videos that no episode in the DB references —
 * orphans left by a process kill between createVideo() succeeding and the
 * DB write that records its guid (see the comment in runMigrate; that path
 * now writes the guid immediately, but this is the net for anything from
 * before that fix, or a kill even earlier than that write). Also cleans up
 * any still-failed/errored Bunny video a DB-linked episode points at —
 * pollHosting deletes these live now, this is the safety net for anything
 * it missed.
 *
 * Paginates the whole Bunny library on every call — cheap in request count
 * but not something to run on every request; a few times a day is plenty.
 */
export async function reconcileBunny(opts: { log?: (m: string) => void } = {}): Promise<ReconcileSummary> {
  const log = opts.log ?? (() => {});
  const started = Date.now();
  if (!bunnyEnabled()) {
    log("Bunny env not configured — skipping reconcile.");
    return {
      bunnyVideos: 0,
      dbHosted: 0,
      orphanedDeleted: 0,
      orphanedStorageBytesFreed: 0,
      failedLinkedCleaned: 0,
      tookMs: 0,
    };
  }

  const videos = await listAllVideos();
  log(`reconcile: ${videos.length} videos in Bunny`);

  const episodes = await db(() =>
    prisma.episode.findMany({
      where: { bunnyGuid: { not: null } },
      select: { id: true, bunnyGuid: true },
    }),
  );
  const dbGuidSet = new Set(episodes.map((e) => e.bunnyGuid as string));

  const orphaned = videos.filter((v) => !dbGuidSet.has(v.guid));
  const orphanedStorageBytesFreed = orphaned.reduce((sum, v) => sum + (v.storageSize || 0), 0);
  log(`reconcile: ${orphaned.length} orphaned videos (~${(orphanedStorageBytesFreed / 1e9).toFixed(2)} GB)`);
  for (const v of orphaned) {
    await deleteVideo(v.guid);
  }

  // status 5 = error, 6 = upload/fetch failed
  const failedGuids = new Set(videos.filter((v) => v.status === 5 || v.status === 6).map((v) => v.guid));
  const failedLinked = episodes.filter((e) => failedGuids.has(e.bunnyGuid as string));
  for (const e of failedLinked) {
    await deleteVideo(e.bunnyGuid as string);
    await db(() => prisma.episode.update({ where: { id: e.id }, data: { bunnyGuid: null } })).catch(() => {});
  }
  log(`reconcile: ${failedLinked.length} failed-but-linked videos cleaned`);

  return {
    bunnyVideos: videos.length,
    dbHosted: episodes.length,
    orphanedDeleted: orphaned.length,
    orphanedStorageBytesFreed,
    failedLinkedCleaned: failedLinked.length,
    tookMs: Date.now() - started,
  };
}
