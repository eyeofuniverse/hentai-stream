import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma, db } from "@/lib/db";
import { thumb, cover } from "@/lib/cloudinary";
import { SITE, SITE_NAME, excerpt } from "@/lib/seo";

/**
 * The sitemap is an index (app/sitemap.xml/route.ts) plus child files by page
 * type (app/sitemap/[id]/route.ts), so
 * Search Console reports indexing per type and no single file is slow to build:
 *
 *   /sitemap/0.xml     hubs, tags, studios, seasons, years
 *   /sitemap/1.xml     series pages
 *   /sitemap/2.xml …   episode pages (with video data), EPISODES_PER_SITEMAP each
 *
 * Character pages (~3.4k thin pages, over a third of the old sitemap) are left
 * out on purpose while the site is new: Google was crawling ~2 real pages a
 * day, and diluting a new domain's sitemap with its thinnest URLs works
 * against it. The pages stay live and linked — to bring them back, add a
 * character child sitemap here.
 *
 * priority/changefreq are omitted (Google ignores both); lastmod is only given
 * where we actually know it.
 */
export const EPISODES_PER_SITEMAP = 1000;
export const SITEMAP_PAGES = 0;
export const SITEMAP_SERIES = 1;
export const SITEMAP_EPISODES_FIRST = 2;

const CACHE_SECONDS = 6 * 60 * 60;
const PUBLISHED_EPISODE = { publish: "PUBLISHED" as const, series: { publish: "PUBLISHED" as const } };

/** XML-escape every value we emit. */
function esc(v: string | number): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A thumbnail URL that's safe to put in XML — our own R2-hosted art only: the
 *  episode's own thumbnail, else the series cover. Never a raw scraped URL
 *  (spaces break the whole sitemap) and never Bunny's CDN, which is
 *  referer-protected so Googlebot can't fetch it. null = list the page
 *  without a video entry rather than point Google at a thumbnail it can't load. */
function safeThumb(coverUrl: string | null, ep: { thumbUrl?: string | null }): string | null {
  const raw = thumb(ep.thumbUrl) ?? thumb(coverUrl) ?? cover(coverUrl);
  if (!raw) return null;
  try {
    const u = encodeURI(raw);
    new URL(u);
    return /\s/.test(u) ? null : u;
  } catch {
    return null;
  }
}

/* Every loader throws when the DB is unreachable — unstable_cache never stores a
   thrown error, and the route handlers answer 503 (no-store), so a blip can't
   leave an empty or partial sitemap cached for hours. */

const episodeCount = unstable_cache(
  () => db(() => prisma.episode.count({ where: PUBLISHED_EPISODE })),
  ["sitemap-episode-count-v2"],
  { revalidate: 3600 },
);

/** ids of every child sitemap: 0 = pages, 1 = series, 2.. = episode chunks. */
export async function sitemapIds(): Promise<number[]> {
  const n = await episodeCount();
  const chunks = Math.max(1, Math.ceil(n / EPISODES_PER_SITEMAP));
  return [SITEMAP_PAGES, SITEMAP_SERIES, ...Array.from({ length: chunks }, (_, i) => SITEMAP_EPISODES_FIRST + i)];
}

const STATIC_PAGES = [
  "",
  "/browse",
  "/browse/new",
  "/browse/trending",
  "/browse/uncensored",
  "/tags",
  "/season",
  "/az",
  "/sitemap-index",
  "/calendar",
  "/dmca",
  "/2257",
  "/terms",
  "/privacy",
];

const pagesDynamic = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const [tags, studios, years, seasons] = await db(() =>
      Promise.all([
        prisma.tag.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true, updatedAt: true } }),
        prisma.studio.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true, updatedAt: true } }),
        prisma.series
          .findMany({ where: { publish: "PUBLISHED", year: { not: null } }, select: { year: true }, distinct: ["year"] })
          .then((rows) => rows.map((r) => r.year as number)),
        prisma.series.groupBy({
          by: ["animeSeason", "seasonYear"],
          where: { publish: "PUBLISHED", animeSeason: { not: null }, seasonYear: { not: null } },
          _count: true,
        }),
      ]),
    );
    return [
      ...tags.map((t) => ({ url: `${SITE}/tag/${t.slug}`, lastModified: t.updatedAt.toISOString() })),
      ...studios.map((s) => ({ url: `${SITE}/studio/${s.slug}`, lastModified: s.updatedAt.toISOString() })),
      ...years.map((y) => ({ url: `${SITE}/browse/year/${y}` })),
      ...seasons
        .filter((s) => s.animeSeason && s.seasonYear && s._count > 0)
        .map((s) => ({ url: `${SITE}/season/${s.animeSeason!.toLowerCase()}-${s.seasonYear}` })),
    ];
  },
  ["sitemap-pages-v2"],
  { revalidate: CACHE_SECONDS },
);

export async function pagesSitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...STATIC_PAGES.map((p) => ({ url: `${SITE}${p}` })),
    ...(await pagesDynamic()),
  ];
}

const seriesCached = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const rows = await db(() =>
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
      }),
    );
    return rows.map((s) => ({ url: `${SITE}/hentai/${s.slug}`, lastModified: s.updatedAt.toISOString() }));
  },
  ["sitemap-series-v2"],
  { revalidate: CACHE_SECONDS },
);

export async function seriesSitemap(): Promise<MetadataRoute.Sitemap> {
  return seriesCached();
}

const episodesCached = unstable_cache(
  async (chunk: number): Promise<MetadataRoute.Sitemap> => {
    const rows = await db(() =>
      prisma.episode.findMany({
        where: PUBLISHED_EPISODE,
        orderBy: { id: "asc" },
        skip: chunk * EPISODES_PER_SITEMAP,
        take: EPISODES_PER_SITEMAP,
        select: {
          number: true,
          title: true,
          runtimeSec: true,
          airedAt: true,
          createdAt: true,
          updatedAt: true,
          thumbUrl: true,
          series: { select: { slug: true, title: true, synopsis: true, coverUrl: true, isCensored: true } },
        },
      }),
    );
    return rows.map((e) => {
      const s = e.series;
      const t = safeThumb(s.coverUrl, e);
      const cen = s.isCensored ? "" : " Uncensored";
      return {
        url: `${SITE}/hentai/${s.slug}/${e.number}`,
        lastModified: e.updatedAt.toISOString(),
        ...(t
          ? {
              videos: [
                {
                  title: `${s.title} Episode ${e.number}${cen}`.slice(0, 100),
                  thumbnail_loc: t,
                  description: excerpt(
                    e.title ||
                      s.synopsis ||
                      `Watch ${s.title} episode ${e.number} hentai online, free HD on ${SITE_NAME}.`,
                    200,
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
    });
  },
  ["sitemap-episodes-v2"],
  { revalidate: CACHE_SECONDS },
);

export async function episodesSitemap(chunk: number): Promise<MetadataRoute.Sitemap> {
  return episodesCached(chunk);
}

/** <urlset> XML for one child sitemap, including Google's video extension. */
export function renderUrlset(entries: MetadataRoute.Sitemap): string {
  const body = entries
    .map((e) => {
      const lastmod = e.lastModified ? `<lastmod>${esc(new Date(e.lastModified).toISOString())}</lastmod>` : "";
      const videos = (e.videos ?? [])
        .map(
          (v) =>
            "<video:video>" +
            `<video:thumbnail_loc>${esc(v.thumbnail_loc)}</video:thumbnail_loc>` +
            `<video:title>${esc(v.title)}</video:title>` +
            `<video:description>${esc(v.description)}</video:description>` +
            (v.player_loc ? `<video:player_loc>${esc(encodeURI(v.player_loc))}</video:player_loc>` : "") +
            (v.duration ? `<video:duration>${esc(v.duration)}</video:duration>` : "") +
            (v.publication_date ? `<video:publication_date>${esc(new Date(v.publication_date).toISOString())}</video:publication_date>` : "") +
            (v.family_friendly ? `<video:family_friendly>${esc(v.family_friendly)}</video:family_friendly>` : "") +
            (v.live ? `<video:live>${esc(v.live)}</video:live>` : "") +
            "</video:video>",
        )
        .join("");
      return `<url><loc>${esc(encodeURI(e.url))}</loc>${lastmod}${videos}</url>`;
    })
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    body +
    `\n</urlset>\n`
  );
}
