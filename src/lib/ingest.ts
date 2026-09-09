import {
  Prisma,
  type VideoHost,
  type ReleaseKind,
  type Quality,
  type SourceStatus,
} from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { canonicalTag, isFeaturedSlug } from "@/lib/metadata/tag-canonical";
import { slugify } from "@/lib/metadata/tags";
import { malEnabled, malSearch, normalize, isHentai } from "@/lib/metadata/mal";
import { importSeries, emptyImportStats } from "@/lib/metadata/importer";

/* ───────────────────────────── title matching ───────────────────────────── */

const SUFFIXES = [
  "the animation",
  "the anime",
  "the motion anime",
  "za animation",
  "original animation",
];

/** Canonical form for comparing a scraped title to our catalogue. */
export function normalizeTitle(raw: string): string {
  let s = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  // trailing episode / part / volume markers
  s = s.replace(
    /\b(episode|ep|epis|capitulo|cap|part|pt|vol|volume|disc)\s*\d+(\s*\d+)?\s*$/,
    "",
  );
  s = s.replace(/\s+\d{1,3}\s*$/, (m) => (raw.length > 12 ? "" : m)); // "... 2"

  for (const suf of SUFFIXES) {
    if (s.endsWith(" " + suf)) s = s.slice(0, -suf.length - 1);
  }
  return s.replace(/\s+/g, " ").trim();
}

const tokens = (s: string) => new Set(s.split(" ").filter((t) => t.length > 1));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SeriesMatch {
  seriesId: string;
  confidence: number; // 0..1
  method: "exact" | "alias" | "jaccard" | "trigram";
  title: string;
}

type Cand = {
  id: string;
  title: string;
  titleEnglish: string | null;
  titleRomaji: string | null;
  titleOriginal: string | null;
  altTitles: string[];
  year: number | null;
  sim: number;
};

/**
 * Resolve a scraped title to one of our Series, or null if we're not confident.
 * Strategy: pg_trgm shortlist → exact normalized match → token Jaccard → raw
 * trigram score, each gated by a confidence floor and (when given) the year.
 */
export async function resolveSeries(opts: {
  title: string;
  year?: number | null;
}): Promise<SeriesMatch | null> {
  const norm = normalizeTitle(opts.title);
  if (norm.length < 2) return null;
  const q = opts.title.trim().slice(0, 200);

  const cands = await db(() =>
    prisma.$queryRaw<Cand[]>(Prisma.sql`
      SELECT id, title, "titleEnglish", "titleRomaji", "titleOriginal",
             "altTitles", year,
             GREATEST(
               similarity(title, ${q}),
               similarity(coalesce("titleEnglish", ''), ${q}),
               similarity(coalesce("titleRomaji", ''), ${q}),
               similarity(coalesce("titleOriginal", ''), ${q})
             ) AS sim
      FROM "Series"
      WHERE title % ${q}
         OR "titleEnglish" % ${q}
         OR "titleRomaji" % ${q}
         OR "titleOriginal" % ${q}
      ORDER BY sim DESC
      LIMIT 20
    `),
  );
  if (!cands.length) return null;

  const nTok = tokens(norm);
  let best: SeriesMatch | null = null;

  for (const c of cands) {
    const variants = [
      c.title,
      c.titleEnglish,
      c.titleRomaji,
      c.titleOriginal,
      ...c.altTitles,
    ]
      .filter(Boolean)
      .map((v) => normalizeTitle(v as string));

    const yearOk =
      opts.year == null || c.year == null || Math.abs(c.year - opts.year) <= 1;

    // 1. exact normalized equality
    if (variants.includes(norm)) {
      const conf = yearOk ? 0.99 : 0.9;
      if (!best || conf > best.confidence)
        best = { seriesId: c.id, confidence: conf, method: "exact", title: c.title };
      continue;
    }

    // 2. token Jaccard over the best variant
    const j = Math.max(...variants.map((v) => jaccard(nTok, tokens(v))), 0);
    if (j >= 0.8 && yearOk) {
      const conf = 0.7 + j * 0.25;
      if (!best || conf > best.confidence)
        best = { seriesId: c.id, confidence: conf, method: "jaccard", title: c.title };
      continue;
    }

    // 3. raw trigram score — needs to be high, and year must agree
    if (c.sim >= 0.55 && yearOk && j >= 0.4) {
      const conf = Math.min(0.85, c.sim);
      if (!best || conf > best.confidence)
        best = { seriesId: c.id, confidence: conf, method: "trigram", title: c.title };
    }
  }

  return best && best.confidence >= 0.62 ? best : null;
}

export interface ResolvedSeries {
  seriesId: string;
  origin: "existing" | "mal-relink" | "mal-import" | "created";
}

async function freeSeriesSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 90) || `series-${Date.now().toString(36)}`;
  for (let i = 0; i < 30; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await db(() =>
      prisma.series.findUnique({ where: { slug: cand }, select: { id: true } }),
    );
    if (!hit) return cand;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Like `resolveSeries`, but falls back to a MAL free-text search (which matches
 * localised titles like "Cream Lemon"), importing the series if MAL has it, and
 * — when `create` is set — creating a bare DRAFT series from the scraped data so
 * a stream site's whole catalogue can be ingested even for titles MAL/AniList
 * never indexed. Enrich fills the metadata later.
 */
export async function resolveOrImportSeries(opts: {
  title: string;
  year?: number | null;
  genres?: string[];
  create?: boolean;
}): Promise<ResolvedSeries | null> {
  const direct = await resolveSeries({ title: opts.title, year: opts.year });
  if (direct) return { seriesId: direct.seriesId, origin: "existing" };

  const norm = normalizeTitle(opts.title);
  if (norm.length < 2) return null;
  const nTok = tokens(norm);

  // MAL search — handles EN ⇄ JP titles
  if (malEnabled()) {
    const hits = await malSearch(opts.title).catch(() => []);
    for (const a of hits) {
      const variants = [
        a.title,
        a.alternative_titles?.en,
        a.alternative_titles?.ja,
        ...(a.alternative_titles?.synonyms ?? []),
      ]
        .filter(Boolean)
        .map((v) => normalizeTitle(v as string));
      const yearOk =
        opts.year == null ||
        !a.start_season?.year ||
        Math.abs(a.start_season.year - opts.year) <= 2;
      const j = Math.max(...variants.map((v) => jaccard(nTok, tokens(v))), 0);
      const exact = variants.includes(norm);
      if (!yearOk || (!exact && j < 0.8)) continue;
      // the stream site listed it as adult; accept MAL's "rx" always, and a
      // softer adult rating only on an exact title + year match
      if (!isHentai(a) && !(exact && ["r+", "r"].includes(a.rating ?? ""))) continue;

      const existing = await db(() =>
        prisma.series.findUnique({
          where: { malId: a.id },
          select: { id: true, altTitles: true },
        }),
      );
      if (existing) {
        if (!existing.altTitles.map(normalizeTitle).includes(norm)) {
          await db(() =>
            prisma.series.update({
              where: { id: existing.id },
              data: { altTitles: { push: opts.title.trim().slice(0, 200) } },
            }),
          ).catch(() => {});
        }
        return { seriesId: existing.id, origin: "mal-relink" };
      }

      await importSeries(normalize(a), emptyImportStats()).catch(() => {});
      const made = await db(() =>
        prisma.series.findUnique({ where: { malId: a.id }, select: { id: true } }),
      );
      if (made) return { seriesId: made.id, origin: "mal-import" };
    }
  }

  if (!opts.create) return null;

  // near-duplicate guard, then bare create
  const near = await db(() =>
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Series"
      WHERE similarity(title, ${opts.title}) > 0.6
      ORDER BY similarity(title, ${opts.title}) DESC
      LIMIT 1
    `),
  ).catch(() => [] as { id: string }[]);
  if (near[0]) {
    await db(() =>
      prisma.series.update({
        where: { id: near[0].id },
        data: { altTitles: { push: opts.title.trim().slice(0, 200) } },
      }),
    ).catch(() => {});
    return { seriesId: near[0].id, origin: "existing" };
  }

  const slug = await freeSeriesSlug(opts.title);
  const created = await db(() =>
    prisma.series.create({
      data: {
        slug,
        title: opts.title.trim().slice(0, 200),
        type: "OVA",
        status: "COMPLETED",
        year: opts.year ?? null,
        publish: "DRAFT",
        metadataSource: "scrape",
      },
      select: { id: true },
    }),
  ).catch(() => null);
  if (!created) return null;

  if (opts.genres?.length)
    await attachSeriesGenres(created.id, opts.genres).catch(() => {});

  return { seriesId: created.id, origin: "created" };
}

/** Record a title the scraper couldn't map. Deduped per site. */
export async function recordUnmatched(opts: {
  site: string;
  rawTitle: string;
  sampleUrl: string;
  year?: number | null;
  episodeCount?: number;
}): Promise<void> {
  const normalizedTitle = normalizeTitle(opts.rawTitle);
  if (!normalizedTitle) return;
  await db(() =>
    prisma.unmatchedTitle.upsert({
      where: { site_normalizedTitle: { site: opts.site, normalizedTitle } },
      create: {
        site: opts.site,
        rawTitle: opts.rawTitle.slice(0, 300),
        normalizedTitle,
        sampleUrl: opts.sampleUrl,
        year: opts.year ?? null,
        episodeCount: opts.episodeCount ?? 0,
      },
      update: {
        hits: { increment: 1 },
        lastSeenAt: new Date(),
        sampleUrl: opts.sampleUrl,
        episodeCount: opts.episodeCount ?? undefined,
      },
    }),
  );
}

/**
 * Attach genre/tag names scraped off a source site to a matched series.
 * Canonicalised through the dictionary (aliases collapse onto one tag), additive
 * only, and skipped entirely for hand-managed (`metadataSource: "manual"`) rows.
 */
export async function attachSeriesGenres(
  seriesId: string,
  rawGenres: string[],
): Promise<number> {
  const canon = [
    ...new Map(
      rawGenres
        .map((g) => canonicalTag(g))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => [c.slug, c] as const),
    ).values(),
  ];
  if (!canon.length) return 0;

  return db(async () => {
    const series = await prisma.series.findUnique({
      where: { id: seriesId },
      select: { metadataSource: true },
    });
    if (!series || series.metadataSource === "manual") return 0;

    const ids: string[] = [];
    for (const c of canon) {
      const t = await prisma.tag.upsert({
        where: { slug: c.slug },
        update: {},
        create: {
          slug: c.slug,
          name: c.name,
          category: c.category,
          featured: isFeaturedSlug(c.slug),
        },
        select: { id: true },
      });
      ids.push(t.id);
    }
    await prisma.series.update({
      where: { id: seriesId },
      data: { tags: { connect: ids.map((id) => ({ id })) } },
    });
    return ids.length;
  });
}

/* ─────────────────────────────── host mapping ───────────────────────────── */

const HOST_ALIASES: Record<string, VideoHost> = {
  streamtape: "STREAMTAPE",
  strtape: "STREAMTAPE",
  stape: "STREAMTAPE",
  tapecontent: "STREAMTAPE",
  doodstream: "DOODSTREAM",
  dood: "DOODSTREAM",
  dooood: "DOODSTREAM",
  ds2play: "DOODSTREAM",
  d0o0d: "DOODSTREAM",
  vidply: "DOODSTREAM",
  mixdrop: "MIXDROP",
  mixdrp: "MIXDROP",
  mdbekjwqa: "MIXDROP",
  voe: "VOE",
  streamwish: "STREAMWISH",
  wishembed: "STREAMWISH",
  embedwish: "STREAMWISH",
  wishfast: "STREAMWISH",
  swishsrv: "STREAMWISH",
  filemoon: "FILEMOON",
  moonplayer: "FILEMOON",
  filemoons: "FILEMOON",
  kerapoxy: "FILEMOON",
  mp4upload: "MP4UPLOAD",
  vidguard: "VIDGUARD",
  listeamed: "VIDGUARD",
  vgfplay: "VIDGUARD",
  lulustream: "LULUSTREAM",
  luluvdo: "LULUSTREAM",
  lulu: "LULUSTREAM",
  bigwarp: "BIGWARP",
  bgwp: "BIGWARP",
  yourupload: "YOURUPLOAD",
  yumeko: "YOURUPLOAD",
};

/** Map a host name or an embed URL to our VideoHost enum. */
export function mapHost(hostOrUrl: string): { host: VideoHost; hostName: string | null } {
  const domain = hostOrUrl
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/^www\d?\./, "");
  const key = domain.split(".")[0].replace(/[^a-z0-9]/g, "");

  for (const [alias, host] of Object.entries(HOST_ALIASES)) {
    if (key.includes(alias)) return { host, hostName: null };
  }
  return { host: "OTHER", hostName: (domain || hostOrUrl).slice(0, 60) };
}

/* ─────────────────────────────── episode ingest ─────────────────────────── */

export interface IngestSource {
  hostOrUrl?: string; // explicit host hint
  embedUrl: string;
  kind?: ReleaseKind;
  language?: string;
  quality?: Quality;
  isCensored?: boolean | null;
  label?: string | null;
  /** embedUrl is a direct video file, not an iframe embed */
  direct?: boolean;
}

export interface IngestResult {
  episodeId: string;
  sourcesAdded: number;
  episodePublished: boolean;
  seriesPublished: boolean;
}

/**
 * Attach one episode's video sources to a matched Series, creating the episode
 * row if needed, and running the auto-publish + spot-check rules:
 *   - episode gets a live source            → publish the episode
 *   - series gets its first published ep     → auto-publish the series + queue it
 *   - series flagged `possible-minor`        → nothing is published
 */
export async function ingestEpisode(opts: {
  seriesId: string;
  number: number;
  part?: number;
  site: string;
  sources: IngestSource[];
  thumbUrl?: string | null;
  airedAt?: string | null;
  /**
   * When false (default) scraped sources land as PENDING and nothing is
   * published — the crawl still records every source, but a link we can't yet
   * serve (referer-locked file, X-Frame-blocked embed) never reaches the public
   * site. Sites whose files are directly hotlinkable pass true.
   */
  publishLive?: boolean;
}): Promise<IngestResult> {
  const part = opts.part && opts.part > 0 ? opts.part : 1;
  const sourceStatus: SourceStatus = opts.publishLive ? "ACTIVE" : "PENDING";

  return db(async () => {
    const series = await prisma.series.findUnique({
      where: { id: opts.seriesId },
      select: { publish: true, contentWarnings: true, slug: true },
    });
    if (!series) throw new Error(`ingestEpisode: no series ${opts.seriesId}`);
    const blocked = series.contentWarnings.includes("possible-minor");

    const airedAt = opts.airedAt ? new Date(opts.airedAt) : null;
    const validAired = airedAt && !Number.isNaN(airedAt.getTime()) ? airedAt : null;

    const ep = await prisma.episode.upsert({
      where: {
        seriesId_number_part: { seriesId: opts.seriesId, number: opts.number, part },
      },
      create: {
        seriesId: opts.seriesId,
        number: opts.number,
        part,
        publish: "DRAFT",
        thumbUrl: opts.thumbUrl ?? null,
        airedAt: validAired,
      },
      update: {},
      select: { id: true, publish: true, thumbUrl: true, airedAt: true },
    });
    // fill thumb / air date only if still missing (don't clobber later data)
    if ((opts.thumbUrl && !ep.thumbUrl) || (validAired && !ep.airedAt)) {
      await prisma.episode.update({
        where: { id: ep.id },
        data: {
          ...(opts.thumbUrl && !ep.thumbUrl ? { thumbUrl: opts.thumbUrl } : {}),
          ...(validAired && !ep.airedAt ? { airedAt: validAired } : {}),
        },
      });
    }

    let sourcesAdded = 0;
    let order = 0;
    for (const s of opts.sources) {
      const url = s.embedUrl?.trim();
      if (!url || !/^https?:\/\//.test(url)) continue;
      const { host, hostName } = mapHost(s.hostOrUrl || url);
      const fields = {
        hostName,
        label: s.label ?? null,
        kind: s.kind ?? "SUB",
        language: s.language ?? "en",
        quality: s.quality ?? "UNKNOWN",
        isCensored: s.isCensored ?? null,
        status: sourceStatus,
        sourceSite: opts.site,
        order: order++,
      };
      const res = await prisma.videoSource.upsert({
        where: { episodeId_host_embedUrl: { episodeId: ep.id, host, embedUrl: url } },
        create: { episodeId: ep.id, host, embedUrl: url, direct: s.direct ?? false, ...fields },
        update: {
          sourceSite: opts.site,
          direct: s.direct ?? false,
          lastCheckedAt: new Date(),
        },
        select: { createdAt: true, updatedAt: true },
      });
      if (res.createdAt.getTime() === res.updatedAt.getTime()) sourcesAdded++;
    }

    const activeCount = opts.publishLive
      ? await prisma.videoSource.count({
          where: { episodeId: ep.id, status: "ACTIVE" },
        })
      : 0;

    let episodePublished = false;
    if (opts.publishLive && !blocked && activeCount > 0 && ep.publish !== "PUBLISHED") {
      await prisma.episode.update({
        where: { id: ep.id },
        data: { publish: "PUBLISHED" },
      });
      episodePublished = true;
    }

    let seriesPublished = false;
    if (opts.publishLive && !blocked && series.publish === "DRAFT") {
      const livePub = await prisma.episode.count({
        where: { seriesId: opts.seriesId, publish: "PUBLISHED" },
      });
      if (livePub > 0) {
        await prisma.series.update({
          where: { id: opts.seriesId },
          data: {
            publish: "PUBLISHED",
            autoPublishedAt: new Date(),
            reviewedAt: null,
          },
        });
        seriesPublished = true;
      }
    }

    return { episodeId: ep.id, sourcesAdded, episodePublished, seriesPublished };
  });
}
