import * as cheerio from "cheerio";
import { Http, sitemapLocs, decodeEntities } from "../http";
import {
  genresFrom,
  seriesTitleFrom,
  yearFrom,
  type EpisodeRef,
  type ScrapedSource,
  type SiteAdapter,
} from "../types";

const BASE = "https://hentaigasm.com";

/**
 * hentaigasm.com — flat WordPress, one post per episode.
 *   posts:  /<title-slug>-<N>-subbed/   (sometimes ...-uncensored-<N>-subbed)
 *   player: inline JWPlayer  jwplayer("player_01").setup({ file: "https://hgasm2.com/<Name> <N> Subbed.mp4", image: "..." })
 * The CDN (hgasm2/hgasm3) is open — direct hotlink, byte ranges, no referer.
 */
export const hentaigasm: SiteAdapter = {
  name: "hentaigasm",
  baseUrl: BASE,

  async *crawl(http, { limit, log }) {
    const idx = (await http.getMaybe(`${BASE}/wp-sitemap.xml`)) ?? "";
    let postSitemaps = sitemapLocs(idx).filter((u) => /posts-post-\d+\.xml/.test(u));
    if (!postSitemaps.length) {
      postSitemaps = Array.from(
        { length: 20 },
        (_, i) => `${BASE}/wp-sitemap-posts-post-${i + 1}.xml`,
      );
    }

    const postUrls: string[] = [];
    for (const sm of postSitemaps) {
      const xml = await http.getMaybe(sm);
      if (!xml) continue;
      for (const u of sitemapLocs(xml)) {
        if (/\/[a-z0-9-]+-\d+-subbed\/?$/i.test(u)) postUrls.push(u);
      }
    }
    log?.(`hentaigasm: ${postUrls.length} episode posts`);

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
      const u = $(el).attr("href") ?? "";
      if (/\/[a-z0-9-]+-\d+-subbed\/?$/i.test(u)) urls.add(u.split("?")[0]);
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
    const rec = parsePost(html, ref.episodeUrl);
    return rec?.sources ?? [];
  },
};

function parsePost(html: string, url: string): EpisodeRef | null {
  const $ = cheerio.load(html);

  const slug = url.match(/\/([a-z0-9-]+)-(\d+)-subbed\/?$/i);
  if (!slug) return null;
  const number = Number(slug[2]);
  if (!Number.isFinite(number) || number < 1) return null;

  const uncensored = /-uncensored-\d+-subbed\/?$/i.test(url);

  // JWPlayer config — read file: / image: straight out of the page
  const file = decodeEntities(
    html.match(/\bfile:\s*["']([^"']+\.(?:mp4|m3u8|webm)[^"']*)["']/i)?.[1] ?? "",
  ).trim();
  const image = decodeEntities(
    html.match(/\bimage:\s*["']([^"']+)["']/i)?.[1] ?? "",
  ).trim();
  const download = decodeEntities(
    $("a[href*='hgasm'][download], a.btn[href$='.mp4'], a[href$='.mp4'][download]").attr("href") ?? "",
  ).trim();

  const enc = (u: string) => u.trim().replace(/ /g, "%20");
  const sources: ScrapedSource[] = [];
  for (const u of [file, download]) {
    if (u && /^https?:\/\/\S.*\.(mp4|m3u8|webm)/i.test(u.replace(/ /g, "_"))) {
      sources.push({
        embedUrl: enc(u),
        hostOrUrl: u,
        direct: true,
        isCensored: uncensored ? false : null,
        quality: "720p",
      });
    }
  }
  if (!sources.length) return null;

  // title: from the file basename ("Nocturnal 1 Subbed" -> "Nocturnal"), else slug
  const fromFile = file
    .split("/")
    .pop()
    ?.replace(/\.(mp4|m3u8|webm).*$/i, "")
    .replace(/%20/g, " ")
    .replace(/^[._\s]+/, ""); // hentaigasm dot-prefixes some filenames
  const rawTitle = fromFile || slug[1].replace(/-/g, " ");
  const seriesTitle = seriesTitleFrom(rawTitle.replace(/\buncensored\b/i, "")).trim();
  if (seriesTitle.length < 2) return null;

  const year =
    yearFrom(
      $("meta[property='article:published_time']").attr("content") ??
        $("time[datetime]").attr("datetime") ??
        "",
    ) ?? null;

  return {
    seriesTitle,
    seriesUrl: url,
    year,
    number,
    episodeUrl: url,
    sources: dedupe(sources),
    thumbUrl: image || null,
    airedAt:
      $("meta[property='article:published_time']").attr("content") ?? null,
    seriesGenres: genresFrom($),
  };
}

function dedupe(list: ScrapedSource[]): ScrapedSource[] {
  const seen = new Set<string>();
  return list.filter((s) => !seen.has(s.embedUrl) && seen.add(s.embedUrl));
}
