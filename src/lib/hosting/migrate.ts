import { prisma, db } from "@/lib/db";
import {
  bunnyEnabled,
  createVideo,
  fetchIntoVideo,
  getVideo,
  mapStatus,
  deleteVideo,
} from "./bunny";
import { publishIfLive } from "@/lib/verify";

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

/** Best Bunny-fetchable source for an episode: a direct file, ACTIVE first,
 *  then by site rank. Player-page embeds (hentaimama) aren't fetchable. */
function pickSource(sources: Src[]): Src | null {
  const usable = sources.filter(
    (s) => s.direct && /^https?:\/\//.test(s.embedUrl) && !/\?dt_embed=/.test(s.embedUrl),
  );
  if (!usable.length) return null;
  return usable.sort((a, b) => {
    const act = (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1);
    if (act) return act;
    return (SITE_RANK[a.sourceSite ?? ""] ?? 9) - (SITE_RANK[b.sourceSite ?? ""] ?? 9);
  })[0];
}

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
        sources: { some: { direct: true } },
        OR: [
          { bunnyGuid: null },
          ...(opts.retry ? [{ bunnyStatus: "failed" as const }] : []),
        ],
      },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 2000,
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

  const gap = opts.gapMs ?? 300;
  for (const ep of episodes) {
    s.episodesSeen++;
    if (ep.series.contentWarnings.includes("possible-minor")) {
      s.skipped++;
      continue;
    }
    const src = pickSource(ep.sources);
    if (!src) {
      s.skipped++;
      continue;
    }
    if (opts.site && src.sourceSite !== opts.site) {
      s.skipped++;
      continue;
    }

    try {
      // a failed retry: drop the old video first
      if (ep.bunnyGuid) await deleteVideo(ep.bunnyGuid);

      const title = `${ep.series.title} - E${ep.number}`;
      const video = await createVideo(title);
      const headers = src.sourceSite ? SITE_REFERER[src.sourceSite] : undefined;
      const res = await fetchIntoVideo(
        video.guid,
        src.embedUrl,
        headers ? { Referer: headers } : undefined,
      );
      if (!res.success && res.statusCode >= 400) {
        await deleteVideo(video.guid);
        throw new Error(`fetch rejected: ${res.message} (${res.statusCode})`);
      }

      await db(() =>
        prisma.episode.update({
          where: { id: ep.id },
          data: {
            bunnyGuid: video.guid,
            bunnyStatus: "fetching",
            bunnyError: null,
          },
        }),
      );
      s.queued++;
      log(`  ↑ ${ep.series.title} E${ep.number} → ${video.guid} (${src.sourceSite})`);
    } catch (e) {
      s.errors.push(`${ep.series.title} E${ep.number}: ${(e as Error).message}`);
      await db(() =>
        prisma.episode.update({
          where: { id: ep.id },
          data: { bunnyStatus: "failed", bunnyError: (e as Error).message.slice(0, 300) },
        }),
      ).catch(() => {});
    }
    if (gap) await new Promise((r) => setTimeout(r, gap));
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
