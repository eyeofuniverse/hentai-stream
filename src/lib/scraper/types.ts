import type { Http } from "./http";

export interface ScrapedSource {
  /** host name, or a URL we can derive the host from */
  hostOrUrl?: string;
  embedUrl: string;
  kind?: "SUB" | "DUB" | "RAW";
  language?: string;
  /** "720p" / "FHD" / "Q1080" — normalised by normQuality */
  quality?: string;
  isCensored?: boolean | null;
  /** embedUrl is a direct video file (play in <video>), not an iframe embed */
  direct?: boolean;
}

/**
 * A pointer to one episode on a source site — cheap to produce (no per-episode
 * fetch). The orchestrator matches `seriesTitle`, decides whether it still needs
 * this episode, and only then calls `fetchSources`.
 */
export interface EpisodeRef {
  seriesTitle: string;
  /** page URL shown in the unmatched queue */
  seriesUrl: string;
  year?: number | null;
  number: number;
  part?: number;
  /** episode page URL — passed back to fetchSources */
  episodeUrl: string;
  /** flat-post adapters (one page = one episode) fill these during crawl so the
   *  orchestrator can skip the second fetch */
  sources?: ScrapedSource[];
  thumbUrl?: string | null;
  airedAt?: string | null;
}

export interface SiteAdapter {
  /** short key — stored on VideoSource.sourceSite and ScrapeRun.site */
  name: string;
  baseUrl: string;

  /** Walk the whole site, yielding lightweight episode pointers. */
  crawl(
    http: Http,
    opts: { limit?: number; log?: (msg: string) => void },
  ): AsyncGenerator<EpisodeRef>;

  /** Top-up: episode pointers for one specific title. */
  findRefsByTitle(http: Http, title: string): Promise<EpisodeRef[]>;

  /** Resolve one episode pointer to its embed sources. */
  fetchSources(http: Http, ref: EpisodeRef): Promise<ScrapedSource[]>;
}

export class NotImplemented extends Error {
  constructor(site: string) {
    super(
      `The "${site}" adapter isn't finished. Run watchhentai first, then paste a ` +
        `sample series + episode page for ${site} and it'll be wired the same way.`,
    );
  }
}

/* ───────────────────────────── shared parsing ───────────────────────────── */

/** "720p" / "FHD" / "Q1080" → our Quality enum value. */
export function normQuality(raw?: string | null): string {
  if (!raw) return "UNKNOWN";
  const s = raw.toLowerCase();
  if (/2160|4k|uhd/.test(s)) return "Q2160";
  if (/1080|fhd/.test(s)) return "Q1080";
  if (/720|\bhd\b/.test(s)) return "Q720";
  if (/480/.test(s)) return "Q480";
  if (/360/.test(s)) return "Q360";
  if (/^q(360|480|720|1080|2160)$/.test(s)) return raw.toUpperCase();
  return "UNKNOWN";
}

/** Episode number from a URL slug or a label like "Episode 3" / "ep-03". */
export function episodeNumFrom(text: string): number | null {
  const m =
    text.match(/epis(?:ode|odio)?[-_ ]?(\d{1,3})/i) ||
    text.match(/\bep[-_ .]?(\d{1,3})\b/i) ||
    text.match(/[-_ ](\d{1,3})[-_ ]?(?:sub|dub|raw|end|uncensored|censored|final)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
}

/** First 19xx/20xx year in a string. */
export function yearFrom(text?: string | null): number | null {
  const m = text?.match(/\b(19[7-9]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Strip episode / language noise from a scraped post title to get the series
 * name. "Doukyuusei Episode 2 English Subbed" → "Doukyuusei".
 */
export function seriesTitleFrom(postTitle: string): string {
  return postTitle
    .replace(/\b(episode|epis(?:o|ó)dio|ep|capitulo|cap)[-_ .]?\d+.*$/i, "")
    .replace(/\b(english|eng|sub(?:bed|titled)?|dub(?:bed)?|raw|uncensored|censored|hd|1080p|720p)\b.*$/i, "")
    .replace(/[-–|:]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
