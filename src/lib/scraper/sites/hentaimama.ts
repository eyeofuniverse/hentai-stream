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

const BASE = "https://hentaimama.io";
const AJAX = `${BASE}/wp-admin/admin-ajax.php`;

/**
 * hentaimama.io — WordPress.
 *   series:   /tvshows/<slug>
 *   episodes: /episodes/<slug>-episode-N/
 *   player:   #option-1.. divs + <a class="options" href="#option-N"> tabs;
 *             body class "postid-<id>"; each tab loads via
 *             POST admin-ajax.php action=get_player_contents&a=<postid>&i=<n>
 *             → JSON array, res[n-1] is the option's HTML (an <iframe>).
 */
export const hentaimama: SiteAdapter = {
  name: "hentaimama",
  baseUrl: BASE,

  async *crawl(http, { limit, log }) {
    // WP core sitemap index → the tvshows child sitemaps
    const idx = (await http.getMaybe(`${BASE}/wp-sitemap.xml`)) ?? "";
    const childSitemaps = sitemapLocs(idx).filter((u) => /tvshows/.test(u));
    if (!childSitemaps.length) childSitemaps.push(`${BASE}/wp-sitemap-posts-tvshows-1.xml`);

    const seriesUrls = new Set<string>();
    for (const sm of childSitemaps) {
      const xml = await http.getMaybe(sm);
      if (xml) for (const u of sitemapLocs(xml)) if (u.includes("/tvshows/")) seriesUrls.add(u);
    }
    log?.(`hentaimama: ${seriesUrls.size} tv shows`);

    let n = 0;
    for (const url of seriesUrls) {
      const html = await http.getMaybe(url);
      if (!html) continue;
      const parsed = parseSeries(html, url);
      if (!parsed) continue;
      for (const ep of parsed.episodes) {
        if (limit && n >= limit) return;
        n++;
        yield {
          seriesTitle: parsed.title,
          seriesUrl: url,
          year: parsed.year,
          number: ep.number,
          episodeUrl: ep.url,
          seriesGenres: parsed.genres,
        };
      }
    }
  },

  async findRefsByTitle(http, title) {
    const html = await http.getMaybe(`${BASE}/?s=${encodeURIComponent(title)}`);
    if (!html) return [];
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $("a[href*='/tvshows/']").each((_, el) => {
      const h = $(el).attr("href");
      if (h) urls.add(h.split("?")[0]);
    });
    const refs: EpisodeRef[] = [];
    for (const url of [...urls].slice(0, 4)) {
      const page = await http.getMaybe(url);
      if (!page) continue;
      const parsed = parseSeries(page, url);
      if (!parsed) continue;
      for (const ep of parsed.episodes)
        refs.push({
          seriesTitle: parsed.title,
          seriesUrl: url,
          year: parsed.year,
          number: ep.number,
          episodeUrl: ep.url,
          seriesGenres: parsed.genres,
        });
    }
    return refs;
  },

  async fetchSources(http, ref) {
    const html = await http.get(ref.episodeUrl);
    const $ = cheerio.load(html);

    const postId =
      ($("body").attr("class") ?? "").match(/postid-(\d+)/)?.[1] ??
      html.match(/get_player_contents['"],\s*a:\s*['"](\d+)['"]/)?.[1];
    if (!postId) return [];

    const count = $("a.options[href^='#option-'], #playex [id^='option-']").length || 1;
    const out: ScrapedSource[] = [];
    for (let i = 1; i <= Math.min(count, 8); i++) {
      try {
        const body = await http.postForm(AJAX, {
          action: "get_player_contents",
          a: postId,
          i: String(i),
        });
        let html_i = "";
        try {
          const arr = JSON.parse(body);
          html_i = Array.isArray(arr) ? arr[i - 1] ?? "" : String(arr);
        } catch {
          html_i = body;
        }
        const src = html_i.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
        if (src) {
          const url = decodeEntities(src.trim()).replace(/^\/\//, "https://");
          if (/^https?:\/\//.test(url)) out.push({ embedUrl: url, hostOrUrl: url });
        }
      } catch {
        /* skip mirror */
      }
    }
    const seen = new Set<string>();
    return out.filter((s) => !seen.has(s.embedUrl) && seen.add(s.embedUrl));
  },
};

function parseSeries(html: string, url: string) {
  const $ = cheerio.load(html);
  const title = $(".data h1, .sheader h1, h1").first().text().trim();
  if (!title) return null;
  const year = yearFrom($(".date, span.date").first().text()) ?? yearFrom(url);

  const episodes: { number: number; url: string }[] = [];
  const seen = new Set<number>();
  $("a[href*='/episodes/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const num = episodeNumFrom(href) ?? episodeNumFrom($(el).text());
    if (num == null || seen.has(num)) return;
    seen.add(num);
    episodes.push({ number: num, url: href.split("?")[0] });
  });
  return { title, year, episodes, genres: genresFrom($) };
}
