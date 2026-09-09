import * as cheerio from "cheerio";
import { Http, sitemapLocs, decodeEntities } from "../http";
import {
  episodeNumFrom,
  genresFrom,
  yearFrom,
  type EpisodeRef,
  type ScrapedSource,
  type SiteAdapter,
} from "../types";

const BASE = "https://miohentai.com";

/**
 * miohentai.com — flat WordPress, one post per episode.
 *   posts:  /<slug>/
 *   title:  og:title = "<Series> – <Episode subtitle> | MioHentai.com"
 *   video:  <video id="video-player" data-video-src="https://cdn.miohentai.com/index.php?data=..." poster="...">
 *           (the default = English sub; other languages load on demand)
 * The CDN is open — direct hotlink, byte ranges, no referer.
 *
 * Caveat: post titles carry no episode number. We take it from the subtitle /
 * poster filename where present, else 1 — so some episodes may need a nudge in
 * the review queue.
 */
export const miohentai: SiteAdapter = {
  name: "miohentai",
  baseUrl: BASE,

  async *crawl(http, { limit, log }) {
    const sitemaps = [
      `${BASE}/post-sitemap.xml`,
      `${BASE}/post-sitemap2.xml`,
      `${BASE}/post-sitemap3.xml`,
      `${BASE}/post-sitemap4.xml`,
    ];
    const postUrls: string[] = [];
    for (const sm of sitemaps) {
      const xml = await http.getMaybe(sm);
      if (!xml) continue;
      for (const u of sitemapLocs(xml)) {
        if (/^https:\/\/miohentai\.com\/[a-z0-9-]+\/$/i.test(u)) postUrls.push(u);
      }
    }
    log?.(`miohentai: ${postUrls.length} episode posts`);

    let n = 0;
    for (const url of postUrls) {
      if (limit && n >= limit) return;
      const html = await http.getMaybe(url);
      if (!html) continue;
      const rec = parsePost(html, url);
      if (!rec) continue;
      n++;
      yield rec;
    }
  },

  async findRefsByTitle(http, title) {
    const html = await http.getMaybe(`${BASE}/?s=${encodeURIComponent(title)}`);
    if (!html) return [];
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $("a[href]").each((_, el) => {
      const u = ($(el).attr("href") ?? "").split("?")[0];
      if (/^https:\/\/miohentai\.com\/[a-z0-9-]+\/$/i.test(u)) urls.add(u);
    });
    const out: EpisodeRef[] = [];
    for (const u of [...urls].slice(0, 12)) {
      const page = await http.getMaybe(u);
      const rec = page && parsePost(page, u);
      if (rec) out.push(rec);
    }
    return out;
  },

  async fetchSources(http, ref) {
    const html = await http.get(ref.episodeUrl);
    return parsePost(html, ref.episodeUrl)?.sources ?? [];
  },
};

function parsePost(html: string, url: string): EpisodeRef | null {
  const $ = cheerio.load(html);

  const src = decodeEntities(
    $("#video-player").attr("data-video-src") ??
      $("video[data-video-src]").attr("data-video-src") ??
      "",
  ).trim();
  if (!/^https?:\/\/\S*cdn\.miohentai/i.test(src)) return null;

  const ogTitle = (
    $("meta[property='og:title']").attr("content") ??
    $("title").text() ??
    ""
  )
    .replace(/\s*\|\s*mio\s*hentai.*$/i, "")
    .trim();
  if (!ogTitle) return null;

  // "<Series> – <subtitle>"  →  series is the part before the dash
  const dash = ogTitle.split(/\s+[–—-]\s+/);
  const seriesTitle = (dash.length > 1 ? dash[0] : ogTitle).trim();
  if (seriesTitle.length < 2) return null;
  const subtitle = dash.slice(1).join(" - ");

  const poster = decodeEntities($("#video-player").attr("poster") ?? "").trim();
  const posterNum = Number(poster.match(/-(\d{1,2})-poster/)?.[1]);
  const number =
    episodeNumFrom(subtitle) ??
    (Number.isFinite(posterNum) && posterNum > 0 ? posterNum : null) ??
    episodeNumFrom(url) ??
    1;

  const year =
    yearFrom($("meta[property='article:published_time']").attr("content") ?? "") ??
    null;

  return {
    seriesTitle,
    seriesUrl: url,
    year,
    number,
    episodeUrl: url,
    thumbUrl: poster || null,
    airedAt: $("meta[property='article:published_time']").attr("content") ?? null,
    seriesGenres: genresFrom($, "a.my-tag[rel='tag'], a[rel='tag'][href*='/tag/']"),
    sources: [
      {
        embedUrl: src,
        hostOrUrl: "cdn.miohentai.com",
        direct: true,
        quality: "720p",
      },
    ],
  };
}
