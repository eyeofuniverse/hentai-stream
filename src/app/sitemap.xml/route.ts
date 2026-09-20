import { sitemapIds } from "@/lib/sitemap-data";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** The sitemap index Search Console and robots.txt point at — one entry per
 *  child sitemap (see lib/sitemap-data.ts). */
export async function GET() {
  try {
    const ids = await sitemapIds();
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      ids.map((id) => `<sitemap><loc>${SITE}/sitemap/${id}.xml</loc></sitemap>`).join("\n") +
      `\n</sitemapindex>\n`;
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // DB unreachable: tell crawlers to retry rather than cache a partial index
    return new Response("Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
