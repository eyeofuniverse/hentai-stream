import { prisma, db } from "@/lib/db";
import type { Prisma, SeriesStatus, SeriesType } from "@prisma/client";

const PAGE = 24;

export type BrowseParams = {
  tag?: string;
  studio?: string;
  type?: string;
  status?: string;
  year?: string;
  sort?: "new" | "updated" | "popular" | "trending" | "rating" | "az";
  page?: number;
};

export async function browseSeries(params: BrowseParams) {
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

  try {
    const [items, total] = await db(() =>
      Promise.all([
        prisma.series.findMany({
          where,
          orderBy,
          skip: (page - 1) * PAGE,
          take: PAGE,
          include: {
            studio: { select: { name: true, slug: true } },
            _count: {
              select: { episodes: { where: { publish: "PUBLISHED" } } },
            },
          },
        }),
        prisma.series.count({ where }),
      ]),
    );
    return { items, total, page, pages: Math.ceil(total / PAGE), pageSize: PAGE };
  } catch {
    return { items: [], total: 0, page, pages: 0, pageSize: PAGE };
  }
}

export async function getSeries(slug: string) {
  return db(() => getSeriesInner(slug));
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
          _count: { select: { sources: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
}

export async function getEpisode(seriesSlug: string, number: number) {
  return db(() => getEpisodeInner(seriesSlug, number));
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
            select: { number: true, title: true },
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

export async function searchSeries(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const ci = { contains: term, mode: "insensitive" as const };
  return db(() => prisma.series.findMany({
    where: {
      publish: "PUBLISHED",
      OR: [
        { title: ci }, // trigram GIN index on Series.title backs this
        { titleRomaji: ci },
        { titleEnglish: ci },
        { titleOriginal: ci },
        { altTitles: { hasSome: [term, ...term.split(/\s+/)] } },
        { synopsis: ci },
      ],
    },
    orderBy: [{ bayesianRating: "desc" }, { viewCount: "desc" }],
    take: 30,
    include: { studio: { select: { name: true, slug: true } } },
  }));
}

const seriesCardSelect = {
  slug: true,
  title: true,
  coverUrl: true,
  year: true,
  type: true,
  status: true,
  _count: { select: { episodes: { where: { publish: "PUBLISHED" as const } } } },
};

const EMPTY_HOME = {
  featured: [] as never[],
  trending: [] as never[],
  recentEpisodes: [] as never[],
  newSeries: [] as never[],
  topRated: [] as never[],
  ongoing: [] as never[],
  genres: [] as never[],
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

  const [featured, trending, recentEpisodes, newSeries, topRated, ongoing, genres] =
    await Promise.all([
      // hero — newest series that has a banner, else newest overall
      prisma.series.findMany({
        where: pub,
        orderBy: [{ bannerUrl: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 5,
        include: {
          tags: { take: 4, orderBy: { name: "asc" } },
          studio: { select: { name: true, slug: true } },
          episodes: {
            where: pub,
            orderBy: { number: "asc" },
            take: 1,
            select: { number: true },
          },
        },
      }),
      prisma.series.findMany({
        where: pub,
        orderBy: [{ trendingScore: "desc" }, { viewCount: "desc" }],
        take: 14,
        select: seriesCardSelect,
      }),
      prisma.episode.findMany({
        where: { ...pub, series: pub },
        orderBy: { createdAt: "desc" },
        take: 14,
        include: {
          series: { select: { slug: true, title: true, coverUrl: true } },
        },
      }),
      prisma.series.findMany({
        where: pub,
        orderBy: { createdAt: "desc" },
        take: 14,
        select: seriesCardSelect,
      }),
      prisma.series.findMany({
        where: { ...pub, ratingCount: { gte: 1 } },
        orderBy: [{ bayesianRating: "desc" }, { ratingCount: "desc" }],
        take: 14,
        select: seriesCardSelect,
      }),
      prisma.series.findMany({
        where: { ...pub, status: "ONGOING" },
        orderBy: { updatedAt: "desc" },
        take: 14,
        select: seriesCardSelect,
      }),
      prisma.tag.findMany({
        where: { category: { in: ["GENRE", "THEME"] } },
        orderBy: { series: { _count: "desc" } },
        take: 12,
        include: { _count: { select: { series: true } } },
      }),
    ]);

  return { featured, trending, recentEpisodes, newSeries, topRated, ongoing, genres };
}
