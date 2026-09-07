/**
 * MyAnimeList API v2 client — public reads via the app Client ID.
 * Docs: https://myanimelist.net/apiconfig/references/api/v2
 *
 * We only need read access to public catalogue data, so a Client ID in the
 * `X-MAL-CLIENT-ID` header is enough (no user OAuth). `nsfw=true` is required
 * on every request or hentai (rating "rx") is filtered out.
 */

const BASE = "https://api.myanimelist.net/v2";
const CLIENT_ID = process.env.MAL_CLIENT_ID ?? "";

export const MAL_FIELDS = [
  "id",
  "title",
  "alternative_titles",
  "synopsis",
  "media_type",
  "status",
  "num_episodes",
  "start_season",
  "start_date",
  "source",
  "average_episode_duration",
  "mean",
  "rating",
  "nsfw",
  "genres",
  "studios",
  "broadcast",
  "main_picture",
  "updated_at",
].join(",");

const SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type MalSeason = (typeof SEASONS)[number];

export interface MalAnime {
  id: number;
  title: string;
  alternative_titles?: { synonyms?: string[]; en?: string; ja?: string };
  synopsis?: string;
  media_type?: string;
  status?: string;
  num_episodes?: number;
  start_season?: { year: number; season: MalSeason };
  start_date?: string;
  source?: string;
  average_episode_duration?: number;
  mean?: number;
  rating?: string;
  nsfw?: string;
  genres?: { id: number; name: string }[];
  studios?: { id: number; name: string }[];
  broadcast?: { day_of_week?: string; start_time?: string };
  main_picture?: { medium?: string; large?: string };
  updated_at?: string;
}

export function malEnabled(): boolean {
  return CLIENT_ID.length > 0;
}

class MalHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function malGet<T>(path: string, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch(`${BASE}${path}`, {
          headers: { "X-MAL-CLIENT-ID": CLIENT_ID },
          cache: "no-store",
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // 4xx (except 429) is a real answer, not a blip — don't retry it.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new MalHttpError(res.status, `MAL ${res.status}: ${await res.text()}`);
      }
      if (!res.ok) throw new Error(`MAL ${res.status}`); // 429 / 5xx → retry
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof MalHttpError) throw err;
      lastErr = err;
      if (i < tries - 1) {
        await new Promise((r) => setTimeout(r, Math.min(20_000, 800 * 2 ** i)));
      }
    }
  }
  throw lastErr;
}

/** One anime by MAL id, hentai included. */
export function getAnime(id: number): Promise<MalAnime> {
  return malGet<MalAnime>(`/anime/${id}?fields=${MAL_FIELDS}&nsfw=true`);
}

/**
 * Every anime in a season (hentai included), following pagination.
 * Returns the raw MalAnime nodes.
 */
export async function getSeason(
  year: number,
  season: MalSeason,
): Promise<MalAnime[]> {
  const out: MalAnime[] = [];
  let path:
    | string
    | null = `/anime/season/${year}/${season}?nsfw=true&limit=500&fields=${MAL_FIELDS}`;

  while (path) {
    let page: { data: { node: MalAnime }[]; paging?: { next?: string } };
    try {
      page = await malGet(path);
    } catch (err) {
      // an empty / not-yet-existing season answers 404 — treat as "no titles"
      if (err instanceof MalHttpError && err.status === 404) break;
      throw err;
    }
    out.push(...page.data.map((d) => d.node));
    path = page.paging?.next ? page.paging.next.replace(BASE, "") : null;
    if (path) await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

export function isHentai(a: MalAnime): boolean {
  return (
    a.rating === "rx" ||
    (a.genres ?? []).some((g) => g.name === "Hentai" || g.name === "Erotica")
  );
}

// ───────────────────────── normalisation ─────────────────────────

const TYPE_MAP: Record<string, string> = {
  ova: "OVA",
  ona: "ONA",
  movie: "MOVIE",
  special: "SPECIAL",
  tv: "SERIES",
  music: "SPECIAL",
  unknown: "OVA",
};

const STATUS_MAP: Record<string, string> = {
  finished_airing: "COMPLETED",
  currently_airing: "ONGOING",
  not_yet_aired: "ANNOUNCED",
};

const SOURCE_MAP: Record<string, string> = {
  original: "ORIGINAL",
  manga: "MANGA",
  "4_koma_manga": "MANGA",
  web_manga: "MANGA",
  digital_manga: "MANGA",
  novel: "LIGHT_NOVEL",
  light_novel: "LIGHT_NOVEL",
  visual_novel: "VISUAL_NOVEL",
  game: "GAME",
  card_game: "GAME",
  book: "OTHER",
  picture_book: "OTHER",
  mixed_media: "OTHER",
  other: "OTHER",
};

const WEEKDAY_MAP: Record<string, string> = {
  monday: "MON",
  tuesday: "TUE",
  wednesday: "WED",
  thursday: "THU",
  friday: "FRI",
  saturday: "SAT",
  sunday: "SUN",
};

export interface NormalizedSeries {
  malId: number;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleOriginal: string | null;
  altTitles: string[];
  synopsis: string | null;
  type: string;
  status: string;
  sourceMaterial: string | null;
  year: number | null;
  animeSeason: string | null;
  seasonYear: number | null;
  totalEpisodes: number | null;
  runtimeSec: number | null;
  externalScore: number | null;
  coverUrl: string | null;
  airDay: string | null;
  genreNames: string[];
  studioNames: string[];
}

export function normalize(a: MalAnime): NormalizedSeries {
  const alt = a.alternative_titles ?? {};
  const year = a.start_season?.year ?? parseYear(a.start_date);
  return {
    malId: a.id,
    title: a.title,
    titleRomaji: a.title || null,
    titleEnglish: alt.en?.trim() || null,
    titleOriginal: alt.ja?.trim() || null,
    altTitles: [...new Set((alt.synonyms ?? []).map((s) => s.trim()).filter(Boolean))],
    synopsis: a.synopsis?.trim() || null,
    type: TYPE_MAP[a.media_type ?? "unknown"] ?? "OVA",
    status: STATUS_MAP[a.status ?? ""] ?? "COMPLETED",
    sourceMaterial: a.source ? (SOURCE_MAP[a.source] ?? "OTHER") : null,
    year: year ?? null,
    animeSeason: a.start_season?.season
      ? a.start_season.season.toUpperCase()
      : null,
    seasonYear: a.start_season?.year ?? null,
    totalEpisodes: a.num_episodes && a.num_episodes > 0 ? a.num_episodes : null,
    runtimeSec:
      a.average_episode_duration && a.average_episode_duration > 0
        ? a.average_episode_duration
        : null,
    externalScore: typeof a.mean === "number" ? a.mean : null,
    coverUrl: a.main_picture?.large ?? a.main_picture?.medium ?? null,
    airDay: a.broadcast?.day_of_week
      ? (WEEKDAY_MAP[a.broadcast.day_of_week.toLowerCase()] ?? null)
      : null,
    genreNames: (a.genres ?? [])
      .map((g) => g.name)
      .filter((n) => n !== "Hentai" && n !== "Erotica"),
    studioNames: (a.studios ?? []).map((s) => s.name),
  };
}

function parseYear(d?: string): number | undefined {
  const m = d?.match(/^(\d{4})/);
  return m ? Number(m[1]) : undefined;
}
