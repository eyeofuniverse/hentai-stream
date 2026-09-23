import { prisma, db } from "@/lib/db";
import { cover, thumb } from "@/lib/cloudinary";
import { defaultSeriesSynopsis } from "@/lib/seo";
import { postToBluesky } from "./bluesky";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";

export type Platform = "bluesky";
export type PromoteResult = Partial<Record<Platform, { ok: true } | { ok: false; error: string }>>;

export type SocialSetting = {
  autoEnabled: boolean;
  autoPlatforms: Platform[];
  defaultTags: string[];
};

const SETTING_DEFAULTS: SocialSetting = { autoEnabled: false, autoPlatforms: ["bluesky"], defaultTags: [] };

export async function getSocialSetting(): Promise<SocialSetting> {
  const row = await db(() => prisma.setting.findUnique({ where: { key: "social" } })).catch(() => null);
  const v = (row?.value as Partial<SocialSetting>) ?? {};
  return {
    autoEnabled: v.autoEnabled ?? SETTING_DEFAULTS.autoEnabled,
    autoPlatforms: Array.isArray(v.autoPlatforms) ? v.autoPlatforms : SETTING_DEFAULTS.autoPlatforms,
    defaultTags: Array.isArray(v.defaultTags) ? v.defaultTags : SETTING_DEFAULTS.defaultTags,
  };
}

function fmtEpNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export type PromoData = {
  title: string;
  caption: string;
  url: string;
  tags: string[];
  coverImageUrl: string | null;
};

export async function buildSeriesPromoData(seriesId: string): Promise<PromoData | null> {
  const series = await db(() =>
    prisma.series.findUnique({
      where: { id: seriesId },
      select: {
        title: true,
        slug: true,
        synopsis: true,
        coverUrl: true,
        type: true,
        year: true,
        isCensored: true,
        studio: { select: { name: true } },
        tags: { select: { name: true } },
        _count: { select: { episodes: true } },
      },
    }),
  );
  if (!series) return null;
  return {
    title: `New series: ${series.title}`,
    caption: (
      series.synopsis ??
      defaultSeriesSynopsis({
        title: series.title,
        type: series.type,
        year: series.year,
        isCensored: series.isCensored,
        studio: series.studio,
        episodeCount: series._count.episodes,
      })
    ).trim(),
    url: `${SITE}/hentai/${series.slug}`,
    tags: series.tags.map((t) => t.name),
    coverImageUrl: cover(series.coverUrl),
  };
}

export async function buildEpisodePromoData(episodeId: string): Promise<PromoData | null> {
  const ep = await db(() =>
    prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        number: true,
        title: true,
        synopsis: true,
        thumbUrl: true,
        series: {
          select: {
            title: true,
            slug: true,
            synopsis: true,
            coverUrl: true,
            type: true,
            year: true,
            isCensored: true,
            studio: { select: { name: true } },
            tags: { select: { name: true } },
            _count: { select: { episodes: true } },
          },
        },
      },
    }),
  );
  if (!ep) return null;
  const epNum = fmtEpNum(ep.number);
  return {
    title: `${ep.series.title} — Episode ${epNum}${ep.title ? `: ${ep.title}` : ""}`,
    caption: (
      ep.synopsis ??
      ep.series.synopsis ??
      defaultSeriesSynopsis({
        title: ep.series.title,
        type: ep.series.type,
        year: ep.series.year,
        isCensored: ep.series.isCensored,
        studio: ep.series.studio,
        episodeCount: ep.series._count.episodes,
      })
    ).trim(),
    url: `${SITE}/hentai/${ep.series.slug}/${ep.number}`,
    tags: ep.series.tags.map((t) => t.name),
    coverImageUrl: thumb(ep.thumbUrl) ?? cover(ep.series.coverUrl),
  };
}

/** Runs the actual platform posts. Used by both the manual admin trigger and
 *  the auto-post hooks below — always Promise.allSettled so one platform
 *  failing doesn't block another. */
export async function runPromote(opts: {
  platforms: Platform[];
  title: string;
  blueskyCaption: string;
  url: string;
  tags: string[];
  coverImageUrl: string | null;
}): Promise<PromoteResult> {
  const tasks: Array<[Platform, Promise<unknown>]> = [];

  if (opts.platforms.includes("bluesky")) {
    tasks.push([
      "bluesky",
      postToBluesky({
        title: opts.title,
        caption: opts.blueskyCaption,
        url: opts.url,
        tags: opts.tags,
        coverImageUrl: opts.coverImageUrl,
      }),
    ]);
  }

  const settled = await Promise.allSettled(tasks.map(([, p]) => p));
  const result: PromoteResult = {};
  tasks.forEach(([platform], i) => {
    const s = settled[i];
    result[platform] =
      s.status === "fulfilled" ? { ok: true } : { ok: false, error: (s as PromiseRejectedResult).reason?.message ?? "failed" };
  });
  return result;
}

/**
 * Auto-post hook — called from the publish pipeline (ingest.ts, verify.ts)
 * whenever a series or episode transitions to PUBLISHED. Deliberately never
 * throws and is meant to be called unawaited (`void autoPromoteOnPublish(...)`)
 * so a social API outage can never delay or break a publish.
 *
 * A brand-new series going live posts a single "new series" announcement
 * (covering episode 1 implicitly) rather than also posting a separate
 * episode announcement for the same moment. `socialPostedAt` is set before
 * the network calls run so the two independent publish paths (ingest +
 * verify) firing back-to-back for the same content can't double-post.
 *
 * BUG FIXED: both current callers are one-shot CLI scripts
 * (scripts/verify.mts, scripts/scrape.mts) that call process.exit()
 * immediately after their main loop finishes. "Unawaited" only protects a
 * long-lived server from being blocked — in a script, process.exit() kills
 * every pending promise outright, so every auto-post was being silently
 * dropped: autoPublishedAt got set fine (an awaited write in the main
 * flow), socialPostedAt never did (the fire-and-forget branch lost the
 * race against exit). Every in-flight call is now tracked here so a script
 * can await flushPendingPromotes() before it exits, without making the
 * publish path itself wait on any of this.
 */
const pending = new Set<Promise<void>>();

function track(p: Promise<void>): void {
  pending.add(p);
  void p.finally(() => pending.delete(p));
}

export function autoPromoteOnPublish(opts: {
  seriesId: string;
  episodeId: string;
  episodePublished: boolean;
  seriesPublished: boolean;
}): void {
  if (opts.seriesPublished) {
    track(autoPromoteSeries(opts.seriesId));
  } else if (opts.episodePublished) {
    track(autoPromoteEpisode(opts.episodeId));
  }
}

/** Batch scripts that call process.exit() right after their main loop must
 *  await this first, or every pending auto-post gets silently killed. */
export async function flushPendingPromotes(): Promise<void> {
  await Promise.allSettled([...pending]);
}

async function autoPromoteSeries(seriesId: string): Promise<void> {
  try {
    const setting = await getSocialSetting();
    if (!setting.autoEnabled || setting.autoPlatforms.length === 0) return;

    const series = await db(() =>
      prisma.series.findUnique({ where: { id: seriesId }, select: { socialPostedAt: true } }),
    );
    if (!series || series.socialPostedAt) return;

    const data = await buildSeriesPromoData(seriesId);
    if (!data) return;

    await db(() => prisma.series.update({ where: { id: seriesId }, data: { socialPostedAt: new Date() } }));

    await runPromote({
      platforms: setting.autoPlatforms,
      title: data.title,
      blueskyCaption: data.caption,
      url: data.url,
      tags: [...setting.defaultTags, ...data.tags],
      coverImageUrl: data.coverImageUrl,
    });
  } catch {
    /* never let a social-posting failure surface to the publish pipeline */
  }
}

async function autoPromoteEpisode(episodeId: string): Promise<void> {
  try {
    const setting = await getSocialSetting();
    if (!setting.autoEnabled || setting.autoPlatforms.length === 0) return;

    const ep = await db(() =>
      prisma.episode.findUnique({ where: { id: episodeId }, select: { socialPostedAt: true } }),
    );
    if (!ep || ep.socialPostedAt) return;

    const data = await buildEpisodePromoData(episodeId);
    if (!data) return;

    await db(() => prisma.episode.update({ where: { id: episodeId }, data: { socialPostedAt: new Date() } }));

    await runPromote({
      platforms: setting.autoPlatforms,
      title: data.title,
      blueskyCaption: data.caption,
      url: data.url,
      tags: [...setting.defaultTags, ...data.tags],
      coverImageUrl: data.coverImageUrl,
    });
  } catch {
    /* ignore */
  }
}
