import { unstable_cache } from "next/cache";
import { prisma, db } from "@/lib/db";
import type { Prisma, SeriesStatus, SeriesType } from "@prisma/client";

const PAGE = 30;

export type BrowseParams = {
  tag?: string;
  studio?: string;
  type?: string;
  status?: string;
  year?: string;
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
  revalidate: 120,
});

async function browseSeriesInner(params: BrowseParams) {
  const page = Math.max(1, params.page ?? 1);

  const where: Prisma.SeriesWhereInput = {
    publish: "PUBLISHED",
    ...(params.tag ? { tags: { some: { slug: params.tag } } } : {}),
    ...(params.studio ? { studio: { slug: params.studio } } : {}),
    ...(params.type ? { type: params.type.toUpperCase() as SeriesType } : {}),
    ...(params.status
      ? { status: params.status.toUpperCase() as SeriesStatus }
      : {}),
    ...(params.year ? { year: Number(params.year) || undefined } : {}),
    ...(params.censored === "false"
      ? { isCensored: false }
      : params.censored === "true"
        ? { isCensored: true }
        : {}),
  };

  const orderBy: Prisma.SeriesOrderByWithRelationInput =
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

export async function getSeries(slug: string) {
  // null on a DB failure rather than throwing — a build-time blip during
  // prerender must not fail the whole deploy (the page 404s, ISR heals it).
  return db(() => getSeriesInner(slug)).catch(() => null);
}
function getSeriesInner(slug: string) {
  return prisma.series.findFirst({
    where: { slug, publish: "PUBLISHED" },
    include: {
      studio: true,
      tags: { orderBy: { name: "asc" } },
      episodes: {
        where: { publish: "PUBLISHED" },
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

export async function getEpisode(seriesSlug: string, number: number) {
  return db(() => getEpisodeInner(seriesSlug, number)).catch(() => null);
}
function getEpisodeInner(seriesSlug: string, number: number) {
  return prisma.episode.findFirst({
    where: {
      number,
      publish: "PUBLISHED",
      series: { slug: seriesSlug, publish: "PUBLISHED" },
    },
    include: {
      series: {
        include: {
          tags: true,
          studio: { select: { name: true, slug: true } },
          episodes: {
            where: { publish: "PUBLISHED" },
            orderBy: { number: "asc" },
            select: {
              number: true,
              title: true,
              bunnyGuid: true,
              bunnyStatus: true,
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

/** Up-to-`limit` other published series that share the most tags with this one. */
export async function relatedSeries(
  seriesId: string,
  tagSlugs: string[],
  limit = 12,
) {
  if (tagSlugs.length === 0) return [];
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
  _count: { select: { episodes: { where: { publish: "PUBLISHED" as const } } } },
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

  // hero shows only the most recent release year we actually have
  const latestYearRow = await prisma.series.findFirst({
    where: { ...pub, year: { not: null } },
    orderBy: { year: "desc" },
    select: { year: true },
  });
  const heroYear = latestYearRow?.year ?? null;

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
    hero,
    trending,
    recentEpisodes,
    newSeries,
    topRated,
    ongoing,
    uncensored,
    featuredTags,
    railTags,
  ] = await Promise.all([
    prisma.series.findMany({
      // hero: never feature an art-less series — a gradient block as the first
      // thing a visitor sees looks broken. Widen to the last two years so it
      // stays full even when this year's crop isn't enriched yet.
      where: {
        ...pub,
        coverUrl: { not: null },
        ...(heroYear ? { year: { gte: heroYear - 1 } } : {}),
      },
      orderBy: [
        { releaseDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 7,
      include: {
        tags: { take: 4, orderBy: { name: "asc" } },
        studio: { select: { name: true, slug: true } },
        episodes: {
          where: pub,
          orderBy: { number: "asc" },
          take: 1,
          select: { number: true },
        },
        _count: { select: { episodes: { where: pub } } },
      },
    }),
    prisma.series.findMany({
      where: pubArt,
      orderBy: [{ trendingScore: "desc" }, { viewCount: "desc" }],
      take: 18,
      select: seriesCardSelect,
    }),
    prisma.episode.findMany({
      where: {
        ...pub,
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
};

const calendarMonthCached = unstable_cache(
  (year: number, month1to12: number) => {
    const start = new Date(Date.UTC(year, month1to12 - 1, 1));
    const end = new Date(Date.UTC(year, month1to12, 1));
    return db(() => calendarMonthInner(start, end));
  },
  ["calendar-month"],
  { revalidate: 900 },
);

export async function calendarMonth(year: number, month1to12: number) {
  try {
    return await calendarMonthCached(year, month1to12);
  } catch {
    return { entries: [] as CalendarEntry[], latestAiredAt: null as Date | null };
  }
}

async function calendarMonthInner(start: Date, end: Date) {
  const [eps, latest] = await Promise.all([
    prisma.episode.findMany({
      where: {
        publish: "PUBLISHED",
        series: { publish: "PUBLISHED" },
        airedAt: { gte: start, lt: end },
      },
      orderBy: { airedAt: "asc" },
      select: {
        number: true,
        airedAt: true,
        bunnyGuid: true,
        bunnyStatus: true,
        series: { select: { slug: true, title: true, coverUrl: true } },
      },
    }),
    prisma.episode.findFirst({
      where: { publish: "PUBLISHED", airedAt: { not: null } },
      orderBy: { airedAt: "desc" },
      select: { airedAt: true },
    }),
  ]);

  const entries: CalendarEntry[] = eps.map((e) => ({
    seriesSlug: e.series.slug,
    seriesTitle: e.series.title,
    coverUrl: e.series.coverUrl,
    number: e.number,
    airedAt: e.airedAt as Date,
    bunnyGuid: e.bunnyGuid,
    bunnyStatus: e.bunnyStatus,
  }));

  return { entries, latestAiredAt: latest?.airedAt ?? null };
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
  { revalidate: 600 },
);

export async function miniLists() {
  try {
    return await miniListsCached();
  } catch {
    return { popular: [], fresh: [] };
  }
}
