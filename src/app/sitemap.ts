import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { thumb, cover, episodeThumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumbUrl } from "@/lib/hosting/bunny";
import { SITE, SITE_NAME, excerpt } from "@/lib/seo";

export const revalidate = 21600;
export const dynamic = "force-dynamic";

/** Next does NOT XML-escape the google video extension fields (or <loc>) — so
 *  every string we hand it must already be clean. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A thumbnail URL that's safe to put in XML — our own hosted art only, never a
 *  raw scraped URL (those carry spaces and break the whole sitemap). */
function safeThumb(
  coverUrl: string | null,
  ep: { bunnyGuid: string | null; bunnyStatus: string | null; thumbUrl?: string | null },
): string | null {
  const bunnyFallback = ep.bunnyStatus === "ready" && ep.bunnyGuid ? bunnyThumbUrl(ep.bunnyGuid) : null;
  const raw = episodeThumb(ep.thumbUrl, bunnyFallback) ?? thumb(coverUrl) ?? cover(coverUrl);
  if (!raw) return null;
  try {
    const u = encodeURI(raw);
    new URL(u);
    return /\s/.test(u) ? null : u;
  } catch {
    return null;
  }
}

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
    runtimeSec: number;
    airedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    bunnyGuid: string | null;
    bunnyStatus: string | null;
    thumbUrl: string | null;
  }[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let series: SeriesRow[] = [];
  let tags: { slug: string; updatedAt: Date }[] = [];
  let studios: { slug: string; updatedAt: Date }[] = [];
  let characters: { slug: string; updatedAt: Date }[] = [];
  let years: number[] = [];

  try {
    [series, tags, studios, characters, years] = await Promise.all([
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
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
              runtimeSec: true,
              airedAt: true,
              createdAt: true,
              updatedAt: true,
              bunnyGuid: true,
              bunnyStatus: true,
              thumbUrl: true,
            },
          },
        },
      }),
      prisma.tag.findMany({
        where: { seriesCount: { gt: 0 } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.studio.findMany({
        where: { seriesCount: { gt: 0 } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.character.findMany({
        where: { seriesCount: { gt: 0 } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.series
        .findMany({
          where: { publish: "PUBLISHED", year: { not: null } },
          select: { year: true },
          distinct: ["year"],
        })
        .then((rows) => rows.map((r) => r.year as number)),
    ]);
  } catch {
    // DB unreachable — still return the static routes
  }

  const staticRoutes: MetadataRoute.Sitemap = (
    [
      ["", 1, "daily"],
      ["/browse", 0.8, "daily"],
      ["/browse/new", 0.7, "daily"],
      ["/browse/trending", 0.7, "daily"],
      ["/browse/uncensored", 0.6, "weekly"],
      ["/tags", 0.7, "weekly"],
      ["/calendar", 0.5, "daily"],
      ["/dmca", 0.2, "yearly"],
      ["/2257", 0.2, "yearly"],
      ["/terms", 0.2, "yearly"],
      ["/privacy", 0.2, "yearly"],
    ] as const
  ).map(([p, priority, changeFrequency]) => ({
    url: `${SITE}${p}`,
    changeFrequency,
    priority,
  }));

  const seriesRoutes: MetadataRoute.Sitemap = series.flatMap((s) => {
    const cen = s.isCensored ? "" : " Uncensored";
    return [
      {
        url: `${SITE}/hentai/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      ...s.episodes.map((e) => {
        const t = safeThumb(s.coverUrl, e);
        return {
          url: `${SITE}/hentai/${s.slug}/${e.number}`,
          lastModified: e.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.7,
          ...(t
            ? {
                videos: [
                  {
                    title: esc(`${s.title} Episode ${e.number}${cen}`.slice(0, 100)),
                    thumbnail_loc: t,
                    description: esc(
                      excerpt(
                        e.title ||
                          s.synopsis ||
                          `Watch ${s.title} episode ${e.number} hentai online, free HD on ${SITE_NAME}.`,
                        200,
                      ),
                    ),
                    // no content_loc — we don't expose raw video URLs (token
                    // proxy). player_loc points at the chrome-less /embed player,
                    // which must differ from <loc> (the article page).
                    player_loc: `${SITE}/embed/${s.slug}/${e.number}`,
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
    lastModified: t.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const studioRoutes: MetadataRoute.Sitemap = studios.map((s) => ({
    url: `${SITE}/studio/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const characterRoutes: MetadataRoute.Sitemap = characters.map((c) => ({
    url: `${SITE}/character/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.3,
  }));

  const yearRoutes: MetadataRoute.Sitemap = years.map((y) => ({
    url: `${SITE}/browse/year/${y}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [
    ...staticRoutes,
    ...seriesRoutes,
    ...tagRoutes,
    ...studioRoutes,
    ...characterRoutes,
    ...yearRoutes,
  ];
}
