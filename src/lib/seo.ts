// strip any trailing slash so `${SITE}${path}` concatenation never double-slashes
export const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
export const SITE_NAME = "LustHentai";

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE}${path}`);

/** First 1–2 sentences of a blurb, capped. */
export function excerpt(text: string | null | undefined, max = 155): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "")) + "…";
}

type EpForSeo = {
  number: number;
  title: string | null;
  synopsis: string | null;
  runtimeSec: number | null;
  series: {
    title: string;
    synopsis: string | null;
    year: number | null;
    isCensored: boolean;
    type: string;
    studio?: { name: string } | null;
    tags: { name: string }[];
  };
};

/** Unique, keyword-rich <title> + description for one episode. */
export function episodeSeo(ep: EpForSeo) {
  const s = ep.series;
  const cen = s.isCensored ? "" : " Uncensored";
  const genres = s.tags.slice(0, 4).map((t) => t.name).join(", ");

  const title = `${s.title} Episode ${ep.number}${cen} — Watch Hentai Online`;

  const lead = ep.synopsis
    ? excerpt(ep.synopsis, 150)
    : excerpt(s.synopsis, 120);
  const facts = [
    `Watch ${s.title} episode ${ep.number} hentai online${s.isCensored ? ", subbed" : " uncensored"}`,
    s.year ? `(${s.year})` : "",
    genres ? `· ${genres}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const description = excerpt(
    lead ? `${facts}. ${lead}` : `${facts}. Free HD streaming on ${SITE_NAME}.`,
    300,
  );

  return { title, description, genres };
}

type SeriesForSynopsis = {
  title: string;
  type: string;
  year: number | null;
  isCensored: boolean;
  studio?: { name: string } | null;
  episodeCount: number;
};

/**
 * A real synopsis is best, but a lot of scrape-only content (no AniList/MAL
 * match — common for doujin/niche titles AniList simply doesn't list) never
 * gets one from the enrichment pipeline. This is the fallback used anywhere
 * a series needs descriptive text and has none: the public series page, and
 * social auto-post captions (src/lib/social/post.ts) — kept in one place so
 * a bland flat placeholder ("New series now streaming.") can't sneak into
 * one call site while this richer, per-series one is used in another.
 */
export function defaultSeriesSynopsis(s: SeriesForSynopsis): string {
  const article = /^[aeiou]/i.test(s.type) ? "an" : "a";
  return (
    `${s.title} is ${article} ${s.type.toLowerCase()} hentai${s.year ? ` from ${s.year}` : ""}` +
    `${s.studio ? ` by ${s.studio.name}` : ""}, ${s.isCensored ? "subbed" : "uncensored"}. ` +
    `Watch all ${s.episodeCount} episode${s.episodeCount === 1 ? "" : "s"} free in HD on ${SITE_NAME}.`
  );
}

/** BreadcrumbList JSON-LD. */
export function breadcrumbLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE,
    logo: `${SITE}/android-chrome-512x512.png`,
  };
}

/** WebSite + SearchAction — enables the Google sitelinks search box. */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
