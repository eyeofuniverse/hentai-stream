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

/** One child sitemap, at /sitemap/<id>.xml — listed by the index in
 *  app/sitemap.xml/route.ts; see lib/sitemap-data.ts for what each id holds. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const m = /^(\d+)\.xml$/.exec(raw);
  if (!m) return new Response("Not Found", { status: 404 });
  const id = Number(m[1]);

  try {
    if (!(await sitemapIds()).includes(id)) return new Response("Not Found", { status: 404 });
    const entries =
      id === SITEMAP_PAGES
        ? await pagesSitemap()
        : id === SITEMAP_SERIES
          ? await seriesSitemap()
          : await episodesSitemap(id - SITEMAP_EPISODES_FIRST);
    return new Response(renderUrlset(entries), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // DB unreachable: tell crawlers to retry rather than cache an empty sitemap
    return new Response("Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
