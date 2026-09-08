import type { Http } from "@/lib/scraper/http";
import type { TagCategory } from "@prisma/client";
import { TAG_DICTIONARY } from "@/lib/metadata/tag-dictionary";
import { slugify } from "@/lib/metadata/tags";

/** the subset of a Series an enricher needs to find its match */
export interface SeriesForEnrich {
  id: string;
  title: string;
  titleEnglish: string | null;
  titleRomaji: string | null;
  titleOriginal: string | null;
  altTitles: string[];
  year: number | null;
  malId: number | null;
  anilistId: number | null;
  nhentaiId: number | null;
  hanimeSlug: string | null;
  anidbId: number | null;
}

export interface EnrichEpisode {
  number: number;
  part?: number;
  title?: string | null;
  synopsis?: string | null;
  thumbUrl?: string | null;
  airedAt?: string | null;
}

export interface EnrichResult {
  matched: boolean;
  /** external id/slug to persist for idempotency */
  externalId?: string | number | null;
  confidence?: number;
  series?: {
    titleEnglish?: string | null;
    titleOriginal?: string | null;
    titleRomaji?: string | null;
    synopsis?: string | null;
    coverUrl?: string | null;
    bannerUrl?: string | null;
    isCensored?: boolean | null;
    studioName?: string | null;
    externalScore?: number | null;
    year?: number | null;
  };
  tags?: string[];
  characters?: string[];
  parody?: string | null;
  artist?: string | null;
  episodes?: EnrichEpisode[];
}

export interface Enricher {
  /** "anilist" | "nhentai" | "hanime" | "anidb" */
  name: string;
  enrich(http: Http, series: SeriesForEnrich): Promise<EnrichResult>;
}

/* ─────────────────────────── tag categorisation ─────────────────────────── */

const DICT_CAT = new Map<string, TagCategory>(
  TAG_DICTIONARY.flatMap((t) => [
    [slugify(t.name), t.category] as const,
    ...(t.synonyms ?? []).map((s) => [slugify(s), t.category] as const),
  ]),
);

const CW = /\b(rape|non[- ]?con|loli|shota|guro|gore|scat|vore|snuff|ryona|torture|bestial|necro|minor|underage|drug)/i;
const FETISH =
  /\b(creampie|nakadashi|paizuri|titf|ahegao|bukkake|gokkun|gangbang|orgy|ntr|netorare|netori|anal|footjob|handjob|blowjob|deepthroat|fellatio|cunnilingus|rimjob|squirt|lactation|tentacle|futanari|yuri|yaoi|femdom|maledom|bondage|bdsm|exhibition|x[- ]?ray|double penetration|spitroast|facesit|pregnant|impregnation|urination|enema|prolapse|fisting)/i;
const FORMAT = /\b(3d|cg|flash|uncensored|censored|dub|sub|short|motion anime)\b/i;
const GENRE = /\b(comedy|drama|romance|fantasy|sci[- ]?fi|horror|action|mystery|slice of life|vanilla|dark)\b/i;

/** Best-guess a category for a tag name coming from an external source. */
export function categorize(name: string): TagCategory {
  const slug = slugify(name);
  const known = DICT_CAT.get(slug);
  if (known) return known;
  if (CW.test(name)) return "CONTENT_WARNING";
  if (FORMAT.test(name)) return "FORMAT";
  if (FETISH.test(name)) return "FETISH";
  if (GENRE.test(name)) return "GENRE";
  return "THEME";
}
