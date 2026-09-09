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

const BASE = "https://watchhentai.net";
const AJAX = `${BASE}/wp-admin/admin-ajax.php`;

/**
 * watchhentai.net — DooPlay WordPress theme.
 *   series pages:   /series/<slug>-id-01/
 *   episode pages:  /videos/<slug>-episode-N-.../
 *   player:         <li class="dooplay_player_option" data-type data-post data-nume>
 *                   → POST admin-ajax.php  action=doo_player_ajax
 *                   → { embed_url, type }   (bare URL, or an <iframe> string)
 */
export const watchhentai: SiteAdapter = {
  name: "watchhentai",
  baseUrl: BASE,

  async *crawl(http, { limit, log }) {
    const seriesUrls: string[] = [];
    for (const sm of ["tvshows-sitemap.xml", "tvshows-sitemap2.xml"]) {
      const xml = await http.getMaybe(`${BASE}/${sm}`);
      if (xml) seriesUrls.push(...sitemapLocs(xml).filter((u) => u.includes("/series/")));
    }
    log?.(`watchhentai: ${seriesUrls.length} series in sitemap`);

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
    $("a[href*='/series/']").each((_, el) => {
      const h = $(el).attr("href");
      if (h && /\/series\/[^/]+\/?$/.test(h)) urls.add(h);
    });

    const refs: EpisodeRef[] = [];
    for (const url of [...urls].slice(0, 4)) {
      const page = await http.getMaybe(url);
      if (!page) continue;
      const parsed = parseSeries(page, url);
      if (!parsed) continue;
      for (const ep of parsed.episodes) {
        refs.push({
          seriesTitle: parsed.title,
          seriesUrl: url,
          year: parsed.year,
          number: ep.number,
          episodeUrl: ep.url,
          seriesGenres: parsed.genres,
        });
      }
    }
    return refs;
  },

  async fetchSources(http, ref) {
    const html = await http.get(ref.episodeUrl);
    const $ = cheerio.load(html);
    const censored =
      /\bcensored\b/i.test(ref.episodeUrl) && !/uncensored/i.test(ref.episodeUrl);

    const opts: { type: string; post: string; nume: string }[] = [];
    $("li.dooplay_player_option").each((_, el) => {
      const e = $(el);
      const type = e.attr("data-type");
      const post = e.attr("data-post");
      const nume = e.attr("data-nume");
      if (type && post && nume) opts.push({ type, post, nume });
    });

    const out: ScrapedSource[] = [];
    for (const o of opts) {
      try {
        const body = await http.postForm(AJAX, {
          action: "doo_player_ajax",
          post: o.post,
          nume: o.nume,
          type: o.type,
        });
        const embed = extractEmbed(body);
        if (embed)
          out.push({
            embedUrl: embed,
            hostOrUrl: embed,
            isCensored: censored,
            // watchhentai's DooPlay AJAX returns a bare file URL (hstorage.xyz
            // mp4 / m3u8), not an iframe embed
            direct: /\.(mp4|m3u8|webm)(\?|$)/i.test(embed),
          });
      } catch {
        /* skip this mirror */
      }
    }
    const seen = new Set<string>();
    return out.filter((x) => !seen.has(x.embedUrl) && seen.add(x.embedUrl));
  },
};

function parseSeries(html: string, url: string) {
  const $ = cheerio.load(html);
  const title = $(".sheader .data h1, h1").first().text().trim();
  if (!title) return null;

  const year =
    yearFrom($(".sheader .data .extra span.date, span.date").first().text()) ??
    yearFrom(url);

  // series slug stem, e.g. .../series/doukyuusei-id-01/ -> "doukyuusei"
  const stem = (url.match(/\/series\/([a-z0-9-]+?)(?:-id-\d+)?\/?$/i)?.[1] ?? "")
    .replace(/-\d+$/, "");

  const episodes: { number: number; url: string }[] = [];
  const seen = new Set<number>();
  // ONLY the real season list — a loose `.episodios li` also catches "related"
  // carousels, which is how "A Forbidden Time" episodes ended up on the
  // "Kodomo no Jikan" page.
  $("#seasons .episodios li").each((_, el) => {
    const a = $(el).find("a[href*='/videos/']").first();
    const href = a.attr("href");
    if (!href) return;
    // the episode slug must share the series stem
    const epSlug = href.match(/\/videos\/([a-z0-9-]+?)-episode-/i)?.[1] ?? "";
    if (stem && epSlug && !epSlug.startsWith(stem.slice(0, 8)) && !stem.startsWith(epSlug.slice(0, 8))) {
      return;
    }
    const num =
      episodeNumFrom(href) ??
      episodeNumFrom($(el).find(".epst, .numerando").text()) ??
      episodeNumFrom(a.text());
    if (num == null || seen.has(num)) return;
    seen.add(num);
    episodes.push({ number: num, url: href });
  });

  return { title, year, episodes, genres: genresFrom($) };
}

/** AJAX response is JSON { embed_url } where embed_url is a bare URL or an
 *  <iframe src="…"> HTML string. */
function extractEmbed(body: string): string | null {
  let raw = body.trim();
  try {
    const j = JSON.parse(raw) as Record<string, string>;
    raw = j.embed_url ?? j.embedURL ?? j.url ?? "";
  } catch {
    /* not JSON — use the body itself */
  }
  if (!raw) return null;
  const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const url = decodeEntities((iframe ? iframe[1] : raw).trim()).replace(/^\/\//, "https://");
  return /^https?:\/\/\S+$/.test(url) ? url : null;
}
