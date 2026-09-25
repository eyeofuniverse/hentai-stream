import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma, db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AnimeSeason, SeriesStatus, SeriesType } from "@prisma/client";

const PAGE = 30;

export type BrowseParams = {
  tag?: string;
  studio?: string;
  character?: string;
  type?: string;
  status?: string;
  year?: string;
  season?: string;
  seasonYear?: string;
  /** "false" = uncensored only, "true" = censored only */
  censored?: string;
  sort?: "new" | "updated" | "popular" | "trending" | "rating" | "az";
  page?: number;
};

export async function browseSeries(params: BrowseParams) {
  const page = Math.max(1, params.page ?? 1);
  try {
    // cache the result per filter-set so repeat navigations don't re-hit the DB
    // (these pages are dynamic — the DB round-trip from far away was the cost)
    return await browseSeriesCached({ ...params, page });
  } catch {
    return { items: [], total: 0, page, pages: 0, pageSize: PAGE };
  }
}

const browseSeriesCached = unstable_cache(browseSeriesInner, ["browse-series"], {
  revalidate: 1800,
});

async function browseSeriesInner(params: BrowseParams) {
  const page = Math.max(1, params.page ?? 1);

  const where: Prisma.SeriesWhereInput = {
    publish: "PUBLISHED",
    ...(params.tag ? { tags: { some: { slug: params.tag } } } : {}),
    ...(params.studio ? { studio: { slug: params.studio } } : {}),
    ...(params.character ? { characters: { some: { slug: params.character } } } : {}),
    ...(params.type ? { type: params.type.toUpperCase() as SeriesType } : {}),
    ...(params.status
      ? { status: params.status.toUpperCase() as SeriesStatus }
      : {}),
    ...(params.year ? { year: Number(params.year) || undefined } : {}),
    ...(params.season ? { animeSeason: params.season.toUpperCase() as AnimeSeason } : {}),
    ...(params.seasonYear ? { seasonYear: Number(params.seasonYear) || undefined } : {}),
    ...(params.censored === "false"
      ? { isCensored: false }
      : params.censored === "true"
        ? { isCensored: true }
        : {}),
  };

  const primarySort: Prisma.SeriesOrderByWithRelationInput =
    params.sort === "popular"
      ? { viewCount: "desc" }
      : params.sort === "trending"
        ? { trendingScore: "desc" }
        : params.sort === "rating"
          ? { bayesianRating: "desc" }
          : params.sort === "az"
            ? { title: "asc" }
            : params.sort === "new"
              ? { createdAt: "desc" }
              : { updatedAt: "desc" };
  // `id` tiebreaker: without one, rows tied on the primary sort key (bulk
  // imports sharing a timestamp, zero-view titles, etc.) have no guaranteed
  // order between separate skip/take queries — page 2+ could silently repeat
  // or drop titles depending on how Postgres happens to order the tie.
  const orderBy: Prisma.SeriesOrderByWithRelationInput[] = [primarySort, { id: "asc" }];

  const [items, total] = await db(() =>
    Promise.all([
      prisma.series.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: seriesCardSelect,
      }),
      prisma.series.count({ where }),
    ]),
  );
  return { items, total, page, pages: Math.ceil(total / PAGE), pageSize: PAGE };
}

// cache() dedupes within a single request — generateMetadata and the page
// component both call this with the same slug, and without it that was two
// full DB round trips (each carrying its own retry-backoff risk, see db.ts)
// on every single uncached series-page render.
export const getSeries = cache(async (slug: string) => {
  // null on a DB failure rather than throwing — a build-time blip during
  // prerender must not fail the whole deploy (the page 404s, ISR heals it).
  return db(() => getSeriesInner(slug)).catch(() => null);
});
function getSeriesInner(slug: string) {
  return prisma.series.findFirst({
    where: { slug, publish: "PUBLISHED" },
    include: {
      studio: true,
      tags: { orderBy: { name: "asc" } },
      characters: { orderBy: { seriesCount: "desc" }, take: 12 },
      episodes: {
        where: { publish: "PUBLISHED", kind: "MAIN" },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          part: true,
          title: true,
          thumbUrl: true,
          runtimeSec: true,
          isCensored: true,
          airedAt: true,
          createdAt: true,
          bunnyGuid: true,
          bunnyStatus: true,
          _count: { select: { sources: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
}

// Same dedup reasoning as getSeries above — the watch page's generateMetadata
// and its page component both fetch the same episode.
export const getEpisode = cache(async (seriesSlug: string, number: number) => {
  return db(() => getEpisodeInner(seriesSlug, number)).catch(() => null);
});
function getEpisodeInner(seriesSlug: string, number: number) {
  return prisma.episode.findFirst({
    where: {
      number,
      publish: "PUBLISHED",
      kind: "MAIN",
      series: { slug: seriesSlug, publish: "PUBLISHED" },
    },
    include: {
      series: {
        include: {
          tags: true,
          studio: { select: { name: true, slug: true } },
          episodes: {
            where: { publish: "PUBLISHED", kind: "MAIN" },
            orderBy: { number: "asc" },
            select: {
              number: true,
              title: true,
              bunnyGuid: true,
              bunnyStatus: true,
              thumbUrl: true,
            },
          },
        },
      },
      sources: {
        where: { status: "ACTIVE" },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

/** Data for the catalogue sidebar (genres, years, top-rated). Cached — it barely
 *  moves and every browse/tag/studio page renders it. */
export const sidebarData = unstable_cache(
  async () => {
    try {
      return await db(async () => {
        const [tags, years, topRated] = await Promise.all([
          prisma.tag.findMany({
            where: { seriesCount: { gt: 0 } },
            orderBy: { seriesCount: "desc" },
            take: 26,
            select: { slug: true, name: true, seriesCount: true },
          }),
          prisma.series.findMany({
            where: { publish: "PUBLISHED", year: { not: null } },
            distinct: ["year"],
            orderBy: { year: "desc" },
            take: 60,
            select: { year: true },
          }),
          prisma.series.findMany({
            where: {
              publish: "PUBLISHED",
              OR: [{ ratingCount: { gte: 1 } }, { externalScore: { gte: 6 } }],
            },
            orderBy: [
              { bayesianRating: "desc" },
              { externalScore: { sort: "desc", nulls: "last" } },
            ],
            take: 8,
            select: {
              slug: true,
              title: true,
              coverUrl: true,
              year: true,
              externalScore: true,
              ratingAvg: true,
              ratingCount: true,
            },
          }),
        ]);
        return {
          tags,
          years: years.map((y) => y.year).filter((y): y is number => y != null),
          topRated,
        };
      });
    } catch {
      return { tags: [], years: [], topRated: [] };
    }
  },
  ["catalog-sidebar"],
  { revalidate: 1800 },
);

/** Up-to-`limit` other published series that share the most tags with this one.
 *  Cached per (seriesId, tags, limit) — every episode page of a series calls
 *  this with the same arguments, and it was a fresh, uncached DB round trip
 *  (with its own independent retry-backoff risk, see db.ts) on every single
 *  one of those renders. "Related series" doesn't need to be fresher than
 *  this — trendingScore/viewCount don't meaningfully move minute to minute. */
const relatedSeriesCached = unstable_cache(
  async (seriesId: string, tagSlugs: string[], limit: number) => {
    try {
      return await db(() =>
        prisma.series.findMany({
          where: {
            publish: "PUBLISHED",
            id: { not: seriesId },
            tags: { some: { slug: { in: tagSlugs } } },
          },
          orderBy: [{ trendingScore: "desc" }, { viewCount: "desc" }],
          take: limit,
          select: seriesCardSelect,
        }),
      );
    } catch {
      return [];
    }
  },
  ["related-series"],
  { revalidate: 1800 },
);

export async function relatedSeries(
  seriesId: string,
  tagSlugs: string[],
  limit = 12,
) {
  if (tagSlugs.length === 0) return [];
  // sort so tag order (which varies by caller) doesn't fragment the cache key
  return relatedSeriesCached(seriesId, [...tagSlugs].sort(), limit);
}

export async function popularTags(limit = 30) {
  try {
    return await db(() =>
      prisma.tag.findMany({
        where: { hideFromDefault: false },
        orderBy: { series: { _count: "desc" } },
        take: limit,
        include: { _count: { select: { series: true } } },
      }),
    );
  } catch {
    return [];
  }
}

const seriesCardSelect = {
  slug: true,
  title: true,
  coverUrl: true,
  year: true,
  type: true,
  status: true,
  isCensored: true,
  externalScore: true,
  _count: {
    select: { episodes: { where: { publish: "PUBLISHED" as const, kind: "MAIN" as const } } },
  },
};

const EMPTY_HOME = {
  hero: [] as never[],
  heroYear: null as number | null,
  trending: [] as never[],
  recentEpisodes: [] as never[],
  newSeries: [] as never[],
  topRated: [] as never[],
  ongoing: [] as never[],
  uncensored: [] as never[],
  genres: [] as never[],
  tagRows: [] as never[],
};

const HERO_INCLUDE = {
  tags: { take: 4, orderBy: { name: "asc" as const } },
  studio: { select: { name: true, slug: true } },
  episodes: {
    where: { publish: "PUBLISHED" as const, kind: "MAIN" as const },
    orderBy: { number: "asc" as const },
    take: 1,
    select: { number: true },
  },
  _count: {
    select: { episodes: { where: { publish: "PUBLISHED" as const, kind: "MAIN" as const } } },
  },
};

/**
 * Hero rail, preferring series that actually have a banner — the fallback for
 * a bannerless series is a heavily blurred, darkened cover, which against the
 * dark theme reads as "nothing there" more than as a backdrop. Only ~1 in 5
 * series has a banner, so picking the newest 7 releases outright (as before)
 * could — and in practice did — land on a run of hero slides with no banner
 * at all. Two-pass: fill from banner-having candidates first, pad with
 * bannerless ones (in the same recency order) only if that's not enough.
 *
 * Ordered by `autoPublishedAt` — when the series actually became watchable on
 * *this* site — not `releaseDate` (the anime's official MAL air date). Those
 * two used to be conflated here, which broke hero two ways: most series MAL
 * lists as still-upcoming get real episodes well before their official date
 * (piracy leaks/scrapes ahead of release), so ordering by releaseDate desc
 * put not-yet-"released" titles at the very top — and since that date never
 * changes, whichever one won stayed pinned there for as long as nothing with
 * an even later date got added, sometimes days. Restricting to `year >=
 * heroYear - 1` on top of that excluded ~92% of what's actually added to the
 * site day to day, since most scraped content is older back-catalog anime,
 * not this year's releases — "new to watch here" and "new anime" are
 * different things for a site with decades of back catalog, and hero should
 * track the former.
 */
async function getHero(pub: { publish: "PUBLISHED" }) {
  const baseWhere = { ...pub, coverUrl: { not: null } };
  const orderBy = [
    { autoPublishedAt: { sort: "desc" as const, nulls: "last" as const } },
    { createdAt: "desc" as const },
  ];

  const withBanner = await prisma.series.findMany({
    where: { ...baseWhere, bannerUrl: { not: null } },
    orderBy,
    take: 7,
    include: HERO_INCLUDE,
  });
  if (withBanner.length >= 7) return withBanner;

  const rest = await prisma.series.findMany({
    where: { ...baseWhere, id: { notIn: withBanner.map((s) => s.id) } },
    orderBy,
    take: 7 - withBanner.length,
    include: HERO_INCLUDE,
  });
  return [...withBanner, ...rest];
}

export async function homeSections() {
  try {
    return await db(() => homeSectionsInner());
  } catch {
    return EMPTY_HOME;
  }
}

async function homeSectionsInner() {
  const pub = { publish: "PUBLISHED" as const };
  // storefront rails only show series that actually have cover art — an
  // un-enriched scrape (no coverUrl) renders as a gradient block and looks broken
  const pubArt = { ...pub, coverUrl: { not: null } };

  // curated genre rails for the homepage (variety over raw size)
  const RAIL_SLUGS = [
    "harem",
    "big-breasts",
    "school",
    "milf",
    "vanilla",
    "ntr",
  ];

  const [
    { hero, heroYear },
    trending,
    recentEpisodes,
    newSeries,
    topRated,
    ongoing,
    uncensored,
    featuredTags,
    railTags,
  ] = await Promise.all([
    // heroYear is just the "Fresh {year} drop" vs "{year} release" badge
    // label in HomeHero — no longer a hero candidate filter (see getHero).
    // Still run alongside the other independent queries below, not before.
    (async () => {
      const [hero, latestYearRow] = await Promise.all([
        getHero(pub),
        prisma.series.findFirst({
          where: { ...pub, year: { not: null } },
          orderBy: { year: "desc" },
          select: { year: true },
        }),
      ]);
      return { hero, heroYear: latestYearRow?.year ?? null };
    })(),
    prisma.series.findMany({
      where: pubArt,
      orderBy: [{ trendingScore: "desc" }, { viewCount: "desc" }],
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.episode.findMany({
      where: {
        ...pub,
        kind: "MAIN",
        series: pub,
        OR: [{ thumbUrl: { not: null } }, { bunnyStatus: "ready" }],
      },
      orderBy: { createdAt: "desc" },
      take: 18,
      include: {
        series: { select: { slug: true, title: true, coverUrl: true } },
      },
    }),
    prisma.series.findMany({
      where: pubArt,
      orderBy: { createdAt: "desc" },
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.series.findMany({
      where: {
        ...pubArt,
        OR: [{ ratingCount: { gte: 1 } }, { externalScore: { not: null } }],
      },
      orderBy: [
        { bayesianRating: "desc" },
        { externalScore: { sort: "desc", nulls: "last" } },
        { ratingCount: "desc" },
      ],
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.series.findMany({
      where: { ...pubArt, status: "ONGOING" },
      orderBy: { updatedAt: "desc" },
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.series.findMany({
      where: { ...pubArt, isCensored: false },
      orderBy: { createdAt: "desc" },
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.tag.findMany({
      where: { featured: true, seriesCount: { gt: 0 } },
      orderBy: { seriesCount: "desc" },
      take: 14,
      select: { slug: true, name: true, seriesCount: true },
    }),
    prisma.tag.findMany({
      where: { slug: { in: RAIL_SLUGS } },
      select: {
        slug: true,
        name: true,
        seriesCount: true,
        series: {
          where: pubArt,
          orderBy: [{ trendingScore: "desc" }, { viewCount: "desc" }],
          take: 12,
          select: seriesCardSelect,
        },
      },
    }),
  ]);

  const genres = featuredTags.map((t) => ({
    slug: t.slug,
    name: t.name,
    seriesCount: t.seriesCount,
  }));

  // keep the curated rail order; only show rails with enough titles to fill a row
  const railBySlug = new Map(railTags.map((t) => [t.slug, t]));
  const tagRows = RAIL_SLUGS.map((slug) => railBySlug.get(slug))
    .filter((t): t is NonNullable<typeof t> => !!t && t.series.length >= 6)
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      seriesCount: t.seriesCount,
      series: t.series,
    }));

  return {
    hero,
    heroYear,
    trending,
    recentEpisodes,
    newSeries,
    topRated,
    ongoing,
    uncensored,
    genres,
    tagRows,
  };
}

/* ── release calendar ── */

export type CalendarEntry = {
  seriesSlug: string;
  seriesTitle: string;
  coverUrl: string | null;
  number: number;
  airedAt: Date;
  bunnyGuid: string | null;
  bunnyStatus: string | null;
  thumbUrl: string | null;
};

const calendarMonthCached = unstable_cache(
  (year: number, month1to12: number) => {
    const start = new Date(Date.UTC(year, month1to12 - 1, 1));
    const end = new Date(Date.UTC(year, month1to12, 1));
    return db(() => calendarMonthInner(start, end));
  },
  ["calendar-month"],
  { revalidate: 3600 },
);

export async function calendarMonth(year: number, month1to12: number) {
  try {
    return await calendarMonthCached(year, month1to12);
  } catch {
    return { entries: [] as CalendarEntry[], latestAiredAt: null as Date | null };
  }
}

/** real per-episode air dates barely exist for this catalogue (~0.2% of
 *  published episodes have one — hentai OVAs/doujin don't carry the weekly
 *  broadcast schedule TV anime does), so this falls back to the *series'*
 *  real release date (Series.releaseDate — a genuine y/m/d from AniList/MAL,
 *  not our own ingestion timestamp) wherever airedAt is missing. An earlier
 *  version of this fell back to Episode.createdAt instead, which showed
 *  "when we scraped it" mislabeled as a release date — every episode from a
 *  bulk-import day looked like it released that day regardless of when it
 *  actually did. Episodes whose series has no confirmed release date either
 *  are simply left off the calendar rather than shown with a fabricated
 *  date. */
async function calendarMonthInner(start: Date, end: Date) {
  const [eps, latest] = await Promise.all([
    prisma.$queryRaw<
      {
        number: number;
        effectiveDate: Date;
        bunnyGuid: string | null;
        bunnyStatus: string | null;
        thumbUrl: string | null;
        slug: string;
        title: string;
        coverUrl: string | null;
      }[]
    >(Prisma.sql`
      SELECT e.number, COALESCE(e."airedAt", s."releaseDate") AS "effectiveDate",
             e."bunnyGuid", e."bunnyStatus", e."thumbUrl",
             s.slug, s.title, s."coverUrl"
      FROM "Episode" e
      JOIN "Series" s ON s.id = e."seriesId"
      WHERE e.publish = 'PUBLISHED' AND e.kind = 'MAIN' AND s.publish = 'PUBLISHED'
        AND COALESCE(e."airedAt", s."releaseDate") >= ${start}
        AND COALESCE(e."airedAt", s."releaseDate") < ${end}
      ORDER BY "effectiveDate" ASC
    `),
    prisma.$queryRaw<{ effectiveDate: Date }[]>(Prisma.sql`
      SELECT COALESCE(e."airedAt", s."releaseDate") AS "effectiveDate"
      FROM "Episode" e
      JOIN "Series" s ON s.id = e."seriesId"
      WHERE e.publish = 'PUBLISHED' AND e.kind = 'MAIN' AND s.publish = 'PUBLISHED'
        AND COALESCE(e."airedAt", s."releaseDate") IS NOT NULL
      ORDER BY "effectiveDate" DESC
      LIMIT 1
    `),
  ]);

  const entries: CalendarEntry[] = eps.map((e) => ({
    seriesSlug: e.slug,
    seriesTitle: e.title,
    coverUrl: e.coverUrl,
    number: e.number,
    airedAt: e.effectiveDate,
    bunnyGuid: e.bunnyGuid,
    bunnyStatus: e.bunnyStatus,
    thumbUrl: e.thumbUrl,
  }));

  return { entries, latestAiredAt: latest[0]?.effectiveDate ?? null };
}

/** Two small series lists for secondary rails (calendar page, empty states). */
const miniListsCached = unstable_cache(
  () => {
    const pub = { publish: "PUBLISHED" as const };
    return db(async () => {
      const [popular, fresh] = await Promise.all([
        prisma.series.findMany({
          where: pub,
          orderBy: [{ viewCount: "desc" }, { trendingScore: "desc" }],
          take: 10,
          select: seriesCardSelect,
        }),
        prisma.series.findMany({
          where: pub,
          orderBy: { createdAt: "desc" },
          take: 10,
          select: seriesCardSelect,
        }),
      ]);
      return { popular, fresh };
    });
  },
  ["mini-lists"],
  { revalidate: 3600 },
);

export async function miniLists() {
  try {
    return await miniListsCached();
  } catch {
    return { popular: [], fresh: [] };
  }
}
