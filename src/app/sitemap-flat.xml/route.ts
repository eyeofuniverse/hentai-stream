import {
  SITEMAP_PAGES,
  SITEMAP_SERIES,
  SITEMAP_EPISODES_FIRST,
  sitemapIds,
  pagesSitemap,
  seriesSitemap,
  episodesSitemap,
  renderUrlset,
} from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";

/**
 * One flat sitemap with every URL — for Google only. Never linked from
 * robots.txt or the index (app/sitemap.xml) that Bing and everyone else use;
 * submitted directly in Search Console instead.
 *
 * Google crawled the old single flat sitemap immediately (everything landed
 * in "Discovered - currently not indexed" within a day). After switching to
 * the index+children split (see lib/sitemap-data.ts), that queue was cleared
 * and the child sitemaps sat completely uncrawled for over a week — the
 * extra hop (index -> discover children -> fetch each) apparently costs too
 * much of this new, low-crawl-budget domain's priority. This restores the
 * flat file for Google specifically while keeping the split version (which
 * reports indexing per page type) for every other engine.
 */
export async function GET() {
  try {
    const ids = await sitemapIds();
    const chunks = await Promise.all(
      ids.map((id) =>
        id === SITEMAP_PAGES
          ? pagesSitemap()
          : id === SITEMAP_SERIES
            ? seriesSitemap()
            : episodesSitemap(id - SITEMAP_EPISODES_FIRST),
      ),
    );
    return new Response(renderUrlset(chunks.flat()), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
