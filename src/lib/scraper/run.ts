import { prisma, db } from "@/lib/db";
import {
  resolveOrImportSeries,
  recordUnmatched,
  ingestEpisode,
  attachSeriesGenres,
  looksLikeTrailer,
} from "@/lib/ingest";
import { Http } from "./http";
import { getAdapter } from "./sites";
import { normQuality, type EpisodeRef, type SiteAdapter } from "./types";

export interface ScrapeOptions {
  /** primary site. For crawl this is the only site walked. For topup/repair
   *  it's also the first site tried, unless `sites` is given. */
  site: string;
  /**
   * topup/repair only: try these sites in order for each target series,
   * moving to the next one only if the series still needs work after the
   * previous site's attempt (e.g. it had nothing, or only covered some of
   * the missing episodes). Ignored for crawl — crawl always walks exactly
   * one site (`site`). Defaults to `[site]` (today's single-site behaviour)
   * when omitted.
   */
  sites?: string[];
  /**
   * crawl  — walk the whole source site, ingest everything new
   * topup  — for our series that are missing video, search the site by title
   * repair — for episodes whose only sources are DEAD (a rotated CDN link),
   *          re-fetch fresh sources by title
   */
  mode: "crawl" | "topup" | "repair";
  limit?: number;
  dryRun?: boolean;
  /** re-fetch sources even for episodes we already have from this site */
  refetch?: boolean;
  /** mark sources ACTIVE + auto-publish. Off by default until a delivery layer
   *  (proxy / re-host) exists — scraped links are referer-locked / X-Frame-blocked
   *  and won't play as raw embeds. */
  publishLive?: boolean;
  /** when a title matches nothing in the catalogue or MAL, create a bare DRAFT
   *  series from the scraped data (crawl only). Default on for crawl. */
  create?: boolean;
  minGapMs?: number;
  log?: (msg: string) => void;
}

export interface ScrapeSummary {
  site: string;
  mode: string;
  titlesSeen: number;
  refsSeen: number;
  matched: number;
  unmatched: number;
  skippedHave: number;
  episodesIngested: number;
  sourcesAdded: number;
  autoPublished: number;
  errors: string[];
  dryRun: boolean;
  tookMs: number;
}

export async function runScrape(opts: ScrapeOptions): Promise<ScrapeSummary> {
  const log = opts.log ?? (() => {});
  const adapter = getAdapter(opts.site);
  const http = new Http(opts.minGapMs ?? 1500);
  const started = Date.now();
  // publishing is `verify`'s job (it checks the link actually streams first) —
  // the scrape just records sources. --publish-live forces the old behaviour.
  const publishLive = opts.publishLive ?? false;
  const create = (opts.create ?? opts.mode === "crawl") && !opts.dryRun;
  // repair always re-fetches — the point is to replace a dead source URL
  const forceRefetch = !!opts.refetch || opts.mode === "repair";

  const s: ScrapeSummary = {
    site: opts.sites?.length ? opts.sites.join(",") : opts.site,
    mode: opts.mode,
    titlesSeen: 0,
    refsSeen: 0,
    matched: 0,
    unmatched: 0,
    skippedHave: 0,
    episodesIngested: 0,
    sourcesAdded: 0,
    autoPublished: 0,
    errors: [],
    dryRun: !!opts.dryRun,
    tookMs: 0,
  };

  const run = opts.dryRun
    ? null
    : await db(() =>
        prisma.scrapeRun.create({
          data: {
            site: opts.sites?.length ? opts.sites.join(",") : opts.site,
            mode: opts.mode,
          },
          select: { id: true },
        }),
      ).catch(() => null);

  const seenTitles = new Set<string>();
  // remember title→match so repeat episodes of one series don't re-resolve
  const matchCache = new Map<string, string | null>();
  // series we've already attached scraped genres to this run
  const genresDone = new Set<string>();

  const handle = async (ref: EpisodeRef, adapter: SiteAdapter, siteName: string) => {
    s.refsSeen++;
    if (!seenTitles.has(ref.seriesTitle)) {
      seenTitles.add(ref.seriesTitle);
      s.titlesSeen++;
    }

    let seriesId = matchCache.get(ref.seriesTitle);
    let matchLabel = "cache";
    if (seriesId === undefined) {
      const m = await resolveOrImportSeries({
        title: ref.seriesTitle,
        year: ref.year,
        genres: ref.seriesGenres,
        create,
      }).catch(() => null);
      seriesId = m?.seriesId ?? null;
      matchLabel = m?.origin ?? "none";
      matchCache.set(ref.seriesTitle, seriesId);
    }

    if (!seriesId) {
      s.unmatched++;
      if (!opts.dryRun)
        await recordUnmatched({
          site: siteName,
          rawTitle: ref.seriesTitle,
          sampleUrl: ref.seriesUrl,
          year: ref.year,
          episodeCount: ref.number,
        }).catch((e) => s.errors.push(`unmatched ${ref.seriesTitle}: ${e.message}`));
      log(`  ? ${ref.seriesTitle} ep ${ref.number} — unmatched`);
      return;
    }
    s.matched++;

    // attach the source site's own genres to the series (once per run)
    if (ref.seriesGenres?.length && !genresDone.has(seriesId) && !opts.dryRun) {
      genresDone.add(seriesId);
      try {
        const added = await attachSeriesGenres(seriesId, ref.seriesGenres);
        if (added) log(`  # ${ref.seriesTitle}: +${added} genres`);
      } catch (e) {
        s.errors.push(`genres ${ref.seriesTitle}: ${(e as Error).message}`);
      }
    }

    // already have this episode from this site? skip the fetch.
    if (!forceRefetch) {
      const have = await db(() =>
        prisma.videoSource.count({
          where: {
            sourceSite: siteName,
            episode: { seriesId, number: ref.number, part: ref.part ?? 1 },
          },
        }),
      ).catch(() => 0);
      if (have > 0) {
        s.skippedHave++;
        return;
      }
    }

    let sources = ref.sources;
    if (!sources?.length) {
      try {
        sources = await adapter.fetchSources(http, ref);
      } catch (e) {
        s.errors.push(`sources ${ref.episodeUrl}: ${(e as Error).message}`);
        return;
      }
    }
    if (!sources.length) {
      log(`  · ${ref.seriesTitle} ep ${ref.number} — no embeds found`);
      return;
    }

    log(
      `  ✓ ${ref.seriesTitle} ep ${ref.number} (${matchLabel}) · ${sources.length} src`,
    );
    if (opts.dryRun) return;

    try {
      const res = await ingestEpisode({
        seriesId,
        number: ref.number,
        part: ref.part,
        site: siteName,
        publishLive,
        thumbUrl: ref.thumbUrl,
        airedAt: ref.airedAt,
        looksLikeTrailer: looksLikeTrailer({
          genres: ref.seriesGenres,
          embedUrls: sources.map((src) => src.embedUrl),
        }),
        sources: sources.map((src) => ({
          hostOrUrl: src.hostOrUrl,
          embedUrl: src.embedUrl,
          kind: src.kind,
          language: src.language,
          quality: normQuality(src.quality) as never,
          isCensored: src.isCensored ?? null,
          direct: src.direct,
        })),
      });
      if (res.sourcesAdded) s.episodesIngested++;
      s.sourcesAdded += res.sourcesAdded;
      if (res.seriesPublished) {
        s.autoPublished++;
        log(`    ↑ auto-published`);
      }
    } catch (e) {
      s.errors.push(`ingest ${ref.seriesTitle} ep ${ref.number}: ${(e as Error).message}`);
    }
  };

  // the where-clause that defines "still needs this mode's kind of work" —
  // used both to pick the initial target list and, after each fallback
  // site's attempt, to check whether a specific series still qualifies (so
  // we only move on to the next site when the previous one didn't finish
  // the job — not on every target regardless of outcome).
  const targetWhere = (mode: "topup" | "repair") =>
    mode === "repair"
      ? {
          // every source on the episode is unusable and at least one is
          // DEAD (a rotated CDN link) — worth re-fetching a fresh URL
          episodes: {
            some: {
              AND: [
                { sources: { some: { status: "DEAD" as const } } },
                { sources: { none: { status: "ACTIVE" as const } } },
                { OR: [{ bunnyStatus: null }, { bunnyStatus: { not: "ready" } }] },
              ],
            },
          },
        }
      : {
          contentWarnings: { isEmpty: true },
          OR: [
            // never got any video
            { publish: "DRAFT" as const, episodes: { none: { sources: { some: {} } } } },
            // published but has episode(s) still missing a source (gap-fill)
            { publish: "PUBLISHED" as const, episodes: { some: { sources: { none: {} } } } },
          ],
        };

  const stillNeedsWork = (mode: "topup" | "repair", seriesId: string) =>
    db(() =>
      prisma.series.count({ where: { id: seriesId, ...targetWhere(mode) } }),
    )
      .then((n) => n > 0)
      .catch(() => true); // unknown → assume still needed, try the next site

  try {
    if (opts.mode === "crawl") {
      for await (const ref of adapter.crawl(http, { limit: opts.limit, log })) {
        await handle(ref, adapter, opts.site);
      }
    } else {
      const mode = opts.mode; // "topup" | "repair" — narrowed, not "crawl"
      const siteList = opts.sites?.length ? opts.sites : [opts.site];
      const targets = await db(() =>
        prisma.series.findMany({
          where: targetWhere(mode),
          orderBy: { bayesianRating: "desc" },
          take: opts.limit ?? 300,
          select: { id: true, title: true, titleRomaji: true, titleEnglish: true },
        }),
      );
      log(`${mode}: ${targets.length} target series across ${siteList.length} site(s): ${siteList.join(", ")}`);
      for (const t of targets) {
        const q = t.titleEnglish || t.title || t.titleRomaji || "";
        for (const siteName of siteList) {
          let siteAdapter: SiteAdapter;
          try {
            siteAdapter = getAdapter(siteName);
          } catch (e) {
            s.errors.push((e as Error).message);
            continue;
          }
          try {
            const refs = await siteAdapter.findRefsByTitle(http, q);
            for (const ref of refs) await handle(ref, siteAdapter, siteName);
          } catch (e) {
            s.errors.push(`findRefsByTitle ${siteName} ${q}: ${(e as Error).message}`);
          }
          // dry-run never writes, so the series can never stop "needing work" —
          // just try every site once and move on.
          if (opts.dryRun) continue;
          if (siteList.length > 1 && !(await stillNeedsWork(mode, t.id))) {
            log(`  ✓ ${q} — satisfied by ${siteName}, skipping remaining site(s)`);
            break;
          }
        }
      }
    }
  } catch (e) {
    s.errors.push(`${opts.mode}: ${(e as Error).message}`);
  }

  s.tookMs = Date.now() - started;

  if (run) {
    await db(() =>
      prisma.scrapeRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          ok: s.errors.length === 0,
          titlesSeen: s.titlesSeen,
          episodesIngested: s.episodesIngested,
          sourcesAdded: s.sourcesAdded,
          matched: s.matched,
          unmatched: s.unmatched,
          errors: s.errors.slice(0, 50),
        },
      }),
    ).catch(() => {});
  }

  return s;
}
