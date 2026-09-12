import { prisma, db } from "@/lib/db";
import {
  bunnyEnabled,
  createVideo,
  fetchIntoVideo,
  getVideo,
  mapStatus,
  deleteVideo,
  thumbUrl as bunnyThumbUrl,
} from "./bunny";
import { publishIfLive } from "@/lib/verify";
import { uploadRemoteToR2 } from "@/lib/r2-upload";

/**
 * Once a video finishes transcoding, Bunny's own thumbnail is the best one
 * we'll ever get for it (generated from the actual hosted file, not
 * whatever the scrape source happened to have) — but hotlinking Bunny's CDN
 * for every card on every page is exactly the recurring-bandwidth cost that
 * prompted this. Copy it into R2 once and store that key in thumbUrl; the
 * display side already prefers thumbUrl over a live Bunny hotlink once it's
 * set (see episodeThumbSrc in cloudinary.ts). Best-effort — a failed copy
 * just leaves the existing hotlink fallback in place, never blocks
 * publishing.
 */
export async function copyBunnyThumbToR2(episodeId: string): Promise<void> {
  try {
    const ep = await db(() =>
      prisma.episode.findUnique({ where: { id: episodeId }, select: { bunnyGuid: true } }),
    );
    if (!ep?.bunnyGuid) return;
    const key = await uploadRemoteToR2(bunnyThumbUrl(ep.bunnyGuid), "episodes/thumbs", episodeId);
    if (key) {
      await db(() => prisma.episode.update({ where: { id: episodeId }, data: { thumbUrl: key } }));
    }
  } catch {
    // best-effort — the live Bunny hotlink stays as the fallback
  }
}

/** Referer a source site's CDN expects, if any. */
const SITE_REFERER: Record<string, string> = {
  watchhentai: "https://watchhentai.net/",
  hentaimama: "https://hentaimama.io/",
};

/** Site preference when an episode has more than one usable source. */
const SITE_RANK: Record<string, number> = {
  hentaigasm: 0,
  miohentai: 1,
  watchhentai: 2,
  hentaimama: 3,
};

type Src = {
  id: string;
  embedUrl: string;
  direct: boolean;
  status: string;
  sourceSite: string | null;
  quality: string;
};

/** All Bunny-fetchable sources for an episode, best first — ACTIVE before
 *  REJECTED, then by site rank. Player-page embeds (hentaimama) aren't
 *  fetchable. Multiple entries = mirror URLs to fall back through. */
function usableSources(sources: Src[]): Src[] {
  return sources
    .filter(
      (s) =>
        s.status !== "DEAD" &&
        s.direct &&
        /^https?:\/\//.test(s.embedUrl) &&
        !/\?dt_embed=/.test(s.embedUrl),
    )
    .sort((a, b) => {
      const act = (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1);
      if (act) return act;
      return (SITE_RANK[a.sourceSite ?? ""] ?? 9) - (SITE_RANK[b.sourceSite ?? ""] ?? 9);
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface HostSummary {
  episodesSeen: number;
  queued: number;
  skipped: number;
  errors: string[];
  tookMs: number;
}

/**
 * Queue episodes into Bunny Stream. For each episode with a fetchable source
 * and no hosted copy: create a Bunny video, tell Bunny to fetch the source
 * (with a Referer header for locked CDNs), record the guid. Bunny transcodes
 * async — the webhook (or `pollHosting`) flips it to ready and publishes.
 */
export async function runMigrate(opts: {
  limit?: number;
  retry?: boolean; // also re-queue previously-failed episodes
  site?: string; // only episodes whose picked source is from this site
  /** also migrate episodes that already have a working hotlink (default: only
   *  migrate episodes whose only sources are locked/rejected — the ones that
   *  can't play any other way) */
  all?: boolean;
  gapMs?: number;
  log?: (m: string) => void;
}): Promise<HostSummary> {
  const log = opts.log ?? (() => {});
  if (!bunnyEnabled()) throw new Error("Bunny env not set");
  const started = Date.now();
  const s: HostSummary = { episodesSeen: 0, queued: 0, skipped: 0, errors: [], tookMs: 0 };

  const episodes = await db(() =>
    prisma.episode.findMany({
      where: {
        AND: [
          { sources: { some: { direct: true, status: { not: "DEAD" as const } } } },
          // default: only episodes that can't play any other way (no live hotlink)
          ...(opts.all ? [] : [{ sources: { none: { status: "ACTIVE" as const } } }]),
        ],
        OR: [
          { bunnyGuid: null },
          ...(opts.retry ? [{ bunnyStatus: "failed" as const }] : []),
        ],
      },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 700,
      select: {
        id: true,
        number: true,
        bunnyGuid: true,
        series: { select: { title: true, contentWarnings: true } },
        sources: {
          select: {
            id: true,
            embedUrl: true,
            direct: true,
            status: true,
            sourceSite: true,
            quality: true,
          },
        },
      },
    }),
  );
  log(`migrate: ${episodes.length} episodes to consider`);

  const run = await db(() =>
    prisma.hostRun.create({ data: {}, select: { id: true } }),
  ).catch(() => null);

  // The source CDNs are small nginx boxes — Bunny's fetch workers get rate-
  // limited / IP-banned if we fire many concurrent fetches. So: one episode at
  // a time, confirm the fetch actually started before moving on, fall through
  // to the mirror URL on failure, and pause between episodes.
  const gap = opts.gapMs ?? 12_000;
  const confirmMs = 9_000;

  for (const ep of episodes) {
    s.episodesSeen++;
    if (ep.series.contentWarnings.includes("possible-minor")) {
      s.skipped++;
      continue;
    }
    let srcs = usableSources(ep.sources);
    if (opts.site) srcs = srcs.filter((x) => x.sourceSite === opts.site);
    if (!srcs.length) {
      s.skipped++;
      continue;
    }

    if (ep.bunnyGuid) await deleteVideo(ep.bunnyGuid).catch(() => {});

    let done = false;
    for (const src of srcs) {
      // Tracked outside the try so the catch block can always clean up a
      // video Bunny created for this attempt — createVideo() succeeding but
      // a LATER step throwing (a transport error out of fetchIntoVideo after
      // its own retries, a timeout, etc.) used to leave that video behind in
      // Bunny forever: never saved to episode.bunnyGuid, so nothing here or
      // in a later retry ever knew to delete it. That's how the library
      // count drifted far above what the DB thinks is hosted.
      let video: Awaited<ReturnType<typeof createVideo>> | null = null;
      try {
        video = await createVideo(`${ep.series.title} - E${ep.number}`);
        const ref = src.sourceSite ? SITE_REFERER[src.sourceSite] : undefined;
        const res = await fetchIntoVideo(
          video.guid,
          src.embedUrl,
          ref ? { Referer: ref } : undefined,
        );
        if (!res.success && res.statusCode >= 400) {
          await deleteVideo(video.guid);
          video = null; // already deleted — don't delete again in the catch
          // the source URL itself is gone (stream sites rotate their CDN links)
          // — mark it DEAD so verify/re-scrape replaces it instead of retrying
          if (/\b(404|410|not found|gone)\b/i.test(res.message ?? "")) {
            await db(() =>
              prisma.videoSource.update({
                where: { id: src.id },
                data: { status: "DEAD", lastCheckedAt: new Date() },
              }),
            ).catch(() => {});
            throw new Error(`source dead (${res.message})`);
          }
          throw new Error(`fetch rejected ${res.statusCode}: ${res.message}`);
        }

        // did Bunny actually pull it? status 6 = fetch failed
        await sleep(confirmMs);
        const chk = await getVideo(video.guid).catch(() => null);
        if (chk && chk.status === 6) {
          await deleteVideo(video.guid);
          video = null;
          throw new Error(`bunny fetch failed (source rate-limited?)`);
        }

        const guid = video.guid;
        await db(() =>
          prisma.episode.update({
            where: { id: ep.id },
            data: { bunnyGuid: guid, bunnyStatus: "fetching", bunnyError: null },
          }),
        );
        s.queued++;
        log(`  ↑ ${ep.series.title} E${ep.number} → ${guid} (${src.sourceSite})`);
        done = true;
        break;
      } catch (e) {
        if (video) await deleteVideo(video.guid).catch(() => {});
        log(`  · ${ep.series.title} E${ep.number} via ${src.sourceSite}: ${(e as Error).message}`);
      }
    }

    if (!done) {
      s.errors.push(`${ep.series.title} E${ep.number}: all mirrors failed`);
      await db(() =>
        prisma.episode.update({
          where: { id: ep.id },
          data: { bunnyStatus: "failed", bunnyError: "all mirrors failed" },
        }),
      ).catch(() => {});
    }
    if (gap) await sleep(gap);
  }

  s.tookMs = Date.now() - started;
  if (run) {
    await db(() =>
      prisma.hostRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          ok: s.errors.length === 0,
          episodesSeen: s.episodesSeen,
          queued: s.queued,
          errors: s.errors.slice(0, 50),
        },
      }),
    ).catch(() => {});
  }
  return s;
}

/**
 * Fallback for when the webhook doesn't fire: poll Bunny for every episode
 * still in a non-terminal state, update status, publish the ready ones.
 */
export async function pollHosting(opts: { limit?: number; log?: (m: string) => void }) {
  const log = opts.log ?? (() => {});
  const pending = await db(() =>
    prisma.episode.findMany({
      where: { bunnyGuid: { not: null }, bunnyStatus: { in: ["queued", "fetching", "processing"] } },
      take: opts.limit ?? 1000,
      select: { id: true, bunnyGuid: true, seriesId: true },
    }),
  );
  log(`poll: ${pending.length} episodes in flight`);
  let ready = 0;
  let failed = 0;

  for (const ep of pending) {
    try {
      const v = await getVideo(ep.bunnyGuid!);
      const status = mapStatus(v.status);
      await db(() =>
        prisma.episode.update({
          where: { id: ep.id },
          data: {
            bunnyStatus: status,
            ...(status === "ready" ? { hostedAt: new Date() } : {}),
            ...(v.length ? { runtimeSec: Math.round(v.length) } : {}),
          },
        }),
      );
      if (status === "ready") {
        ready++;
        await copyBunnyThumbToR2(ep.id);
        await publishIfLive(ep.id);
      } else if (status === "failed") {
        failed++;
      }
    } catch (e) {
      log(`  poll ${ep.bunnyGuid}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { checked: pending.length, ready, failed };
}
