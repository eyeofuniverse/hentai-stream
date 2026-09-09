import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { thumb, cover } from "@/lib/cloudinary";
import { SITE, SITE_NAME, excerpt } from "@/lib/seo";

export const revalidate = 3600;
export const dynamic = "force-dynamic"; // generated on request, not at build

type SeriesRow = {
  slug: string;
  title: string;
  synopsis: string | null;
  coverUrl: string | null;
  isCensored: boolean;
  updatedAt: Date;
  episodes: {
    number: number;
    title: string | null;
    thumbUrl: string | null;
    runtimeSec: number;
    airedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let series: SeriesRow[] = [];
  let tags: { slug: string }[] = [];
  let studios: { slug: string }[] = [];

  try {
    [series, tags, studios] = await Promise.all([
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        select: {
          slug: true,
          title: true,
          synopsis: true,
          coverUrl: true,
          isCensored: true,
          updatedAt: true,
          episodes: {
            where: { publish: "PUBLISHED" },
            orderBy: { number: "asc" },
            select: {
              number: true,
              title: true,
              thumbUrl: true,
              runtimeSec: true,
              airedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      prisma.tag.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true } }),
      prisma.studio.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true } }),
    ]);
  } catch {
    // DB unreachable — still return the static routes
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    ["", 1],
    ["/browse", 0.8],
    ["/tags", 0.6],
    ["/dmca", 0.2],
    ["/2257", 0.2],
    ["/terms", 0.2],
    ["/privacy", 0.2],
  ].map(([p, priority]) => ({
    url: `${SITE}${p}`,
    changeFrequency: "daily",
    priority: priority as number,
  }));

  const seriesRoutes: MetadataRoute.Sitemap = series.flatMap((s) => {
    const seriesThumb = cover(s.coverUrl);
    return [
      {
        url: `${SITE}/hentai/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      ...s.episodes.map((e) => {
        const t = thumb(e.thumbUrl) ?? seriesThumb;
        return {
          url: `${SITE}/hentai/${s.slug}/${e.number}`,
          lastModified: e.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.7,
          ...(t
            ? {
                videos: [
                  {
                    title: `${s.title} Episode ${e.number}${
                      s.isCensored ? "" : " Uncensored"
                    }`.slice(0, 100),
                    thumbnail_loc: t,
                    description: excerpt(
                      e.title ??
                        s.synopsis ??
                        `Watch ${s.title} episode ${e.number} hentai online, free HD on ${SITE_NAME}.`,
                      200,
                    ),
                    content_loc: `${SITE}/hentai/${s.slug}/${e.number}`,
                    player_loc: `${SITE}/hentai/${s.slug}/${e.number}`,
                    publication_date: (e.airedAt ?? e.createdAt).toISOString(),
                    ...(e.runtimeSec ? { duration: e.runtimeSec } : {}),
                    family_friendly: "no" as const,
                    live: "no" as const,
                  },
                ],
              }
            : {}),
        };
      }),
    ];
  });

  const tagRoutes: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${SITE}/tag/${t.slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const studioRoutes: MetadataRoute.Sitemap = studios.map((s) => ({
    url: `${SITE}/studio/${s.slug}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...seriesRoutes, ...tagRoutes, ...studioRoutes];
}
