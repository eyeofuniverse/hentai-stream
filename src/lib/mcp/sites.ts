/**
 * The properties this MCP server can report on. Every tool takes a `site`
 * argument keyed against this map rather than each site getting its own
 * copy of every tool — one tool list, pick the site per call.
 *
 * Per-site env var suffix is the map key, upper-cased (lustpages ->
 * _LUSTPAGES). lusthentai has no suffix for backwards compatibility with
 * the vars this MCP already shipped with (GA4_PROPERTY_ID, BING_SITE_URL).
 */
export type SiteKey = "lusthentai" | "lustpages";

export type SiteConfig = {
  label: string;
  ga4PropertyId: string;
  bingSiteUrl: string;
  /** Search Console property identifier — "sc-domain:x.com" (Domain
   *  property) or "https://x.com/" (URL-prefix property), whichever that
   *  site was verified as. */
  gscSiteUrl: string;
};

export const SITES: Record<SiteKey, SiteConfig> = {
  lusthentai: {
    label: "LustHentai",
    ga4PropertyId: process.env.GA4_PROPERTY_ID ?? "",
    bingSiteUrl: process.env.BING_SITE_URL ?? "https://lusthentai.com/",
    gscSiteUrl: process.env.GSC_SITE_URL ?? "sc-domain:lusthentai.com",
  },
  lustpages: {
    label: "LustPages",
    ga4PropertyId: process.env.GA4_PROPERTY_ID_LUSTPAGES ?? "",
    bingSiteUrl: process.env.BING_SITE_URL_LUSTPAGES ?? "https://lustpages.com/",
    gscSiteUrl: process.env.GSC_SITE_URL_LUSTPAGES ?? "sc-domain:lustpages.com",
  },
};

export const SITE_KEYS = Object.keys(SITES) as SiteKey[];
