import { prisma, db } from "@/lib/db";
import {
  resolveOrImportSeries,
  recordUnmatched,
  ingestEpisode,
  attachSeriesGenres,
} from "@/lib/ingest";
import { Http } from "./http";
import { getAdapter } from "./sites";
import { normQuality, type EpisodeRef } from "./types";

export interface ScrapeOptions {
  site: string;
  mode: "crawl" | "topup";
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

  const s: ScrapeSummary = {
    site: opts.site,
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
          data: { site: opts.site, mode: opts.mode },
          select: { id: true },
        }),
      ).catch(() => null);

  const seenTitles = new Set<string>();
  // remember title→match so repeat episodes of one series don't re-resolve
  const matchCache = new Map<string, string | null>();
  // series we've already attached scraped genres to this run
  const genresDone = new Set<string>();

  const handle = async (ref: EpisodeRef) => {
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
          site: opts.site,
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
    if (!opts.refetch) {
      const have = await db(() =>
        prisma.videoSource.count({
          where: {
            sourceSite: opts.site,
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
        site: opts.site,
        publishLive,
        thumbUrl: ref.thumbUrl,
        airedAt: ref.airedAt,
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

  try {
    if (opts.mode === "crawl") {
      for await (const ref of adapter.crawl(http, { limit: opts.limit, log })) {
        await handle(ref);
      }
    } else {
      const targets = await db(() =>
        prisma.series.findMany({
          where: {
            contentWarnings: { isEmpty: true },
            OR: [
              // never got any video
              { publish: "DRAFT", episodes: { none: { sources: { some: {} } } } },
              // published but has episode(s) still missing a source (gap-fill)
              { publish: "PUBLISHED", episodes: { some: { sources: { none: {} } } } },
            ],
          },
          orderBy: { bayesianRating: "desc" },
          take: opts.limit ?? 300,
          select: { title: true, titleRomaji: true, titleEnglish: true },
        }),
      );
      log(`topup: ${targets.length} series missing video`);
      for (const t of targets) {
        const q = t.titleEnglish || t.title || t.titleRomaji || "";
        try {
          for (const ref of await adapter.findRefsByTitle(http, q)) await handle(ref);
        } catch (e) {
          s.errors.push(`findRefsByTitle ${q}: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    s.errors.push(`crawl: ${(e as Error).message}`);
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
