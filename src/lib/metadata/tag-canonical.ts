import type { TagCategory } from "@prisma/client";
import { TAG_DICTIONARY } from "./tag-dictionary";
import { slugify } from "./tags";
import { isNotAGenre } from "./tag-stoplist";

export type CanonicalTag = { slug: string; name: string; category: TagCategory };

/* ─────────────────────────── categorisation ─────────────────────────── */

const DICT_CAT = new Map<string, TagCategory>(
  TAG_DICTIONARY.flatMap((t) => [
    [slugify(t.name), t.category] as const,
    ...(t.synonyms ?? []).map((s) => [slugify(s), t.category] as const),
  ]),
);

const CW =
  /\b(rape|non[- ]?con|guro|gore|scat|vore|snuff|ryona|torture|bestial|zoophil|beast|necro|cannibal|drug|abuse|violat|asphyxia|strangl)/i;
const FETISH =
  /\b(creampie|nakadashi|paizuri|titf|boobjob|ahegao|bukkake|gokkun|gangbang|orgy|ntr|netorare|netori|anal|footjob|handjob|blowjob|deepthroat|fellatio|irrumatio|cunnilingus|rimjob|squirt|lactation|tentacle|futanari|yuri|yaoi|femdom|maledom|matriarch|bondage|bdsm|exhibition|x[- ]?ray|double penetration|spitroast|facesit|pregnant|impregnation|urination|omorashi|watersport|enema|prolapse|fisting|threesome|groupsex|group sex|armpit|waki|pet.?play|human.?pet|leash|breath.?play|choking|sweat|crossdress|otokonoko|cervix|portio|spanking|hair.?pulling|choukyou|dark.?skin|mind.?break|mesugaki|bimbo|corrupt)/i;
const FORMAT = /\b(3d|3dcg|cgi|cg|flash|motion anime|motion comic|live action)\b/i;
const GENRE =
  /\b(comedy|drama|romance|fantasy|sci[- ]?fi|science fiction|horror|thriller|action|mystery|adventure|isekai|vanilla|supernatural|paranormal|magical|mecha|apocalyp|superhero|super power|psychological)\b/i;

/** Category if the name matches a known pattern, else null (didn't recognise). */
export function categorizeStrict(name: string): TagCategory | null {
  const known = DICT_CAT.get(slugify(name));
  if (known) return known;
  if (CW.test(name)) return "CONTENT_WARNING";
  if (FORMAT.test(name)) return "FORMAT";
  if (FETISH.test(name)) return "FETISH";
  if (GENRE.test(name)) return "GENRE";
  return null;
}

/** Best-guess a category for a tag name coming from an external source. */
export function categorize(name: string): TagCategory {
  return categorizeStrict(name) ?? "THEME";
}

/* ─────────────────────────── canonicalisation ─────────────────────────── */

/**
 * Not genres — censorship status, language, release state, quality, and generic
 * junk that source sites list alongside real genres. `canonicalTag` drops these.
 */
const IGNORE = new Set(
  [
    "censored", "uncensored", "sub", "subbed", "subtitled", "dub", "dubbed",
    "raw", "english", "english-sub", "english-subbed", "eng-sub", "hentai",
    "anime", "ongoing", "completed", "complete", "finished", "upcoming",
    "airing", "ended", "hd", "sd", "fhd", "uhd", "4k", "1080p", "720p", "480p",
    "new", "latest", "popular", "trending", "featured", "recommended",
    "uncategorized", "uncategorised", "other", "others", "misc", "general",
    "download", "downloads", "stream", "streaming", "watch", "watch-online",
    "no-genre", "none", "n-a", "tba", "unknown",
  ],
);

/** alias slug → the dictionary tag it should collapse onto */
const ALIAS = new Map<string, CanonicalTag>();
for (const t of TAG_DICTIONARY) {
  const canon: CanonicalTag = {
    slug: slugify(t.name),
    name: t.name,
    category: t.category,
  };
  ALIAS.set(canon.slug, canon);
  for (const syn of t.synonyms ?? []) {
    const s = slugify(syn);
    if (s.length >= 2 && !ALIAS.has(s)) ALIAS.set(s, canon);
  }
}

/**
 * Resolve any raw tag string to the tag we should actually store.
 *   - dictionary names + synonyms collapse onto one canonical tag
 *   - status / language / non-genre (cast, sport, hobby, …) terms → null
 *   - `allowNew: false` (used for the AniList/nhentai firehose) additionally
 *     rejects anything that doesn't match a known content pattern, so enrich
 *     can't mint junk THEME tags. Source-site genres pass `allowNew: true`.
 */
export function canonicalTag(
  raw: string,
  opts: { allowNew?: boolean } = {},
): CanonicalTag | null {
  const allowNew = opts.allowNew ?? true;
  const s = slugify(raw.trim());
  if (s.length < 2 || IGNORE.has(s) || isNotAGenre(s)) return null;

  // exact, then a couple of cheap singular forms ("maids"→"maid",
  // "office-ladies"→"office-lady", "demons"→"demon")
  const forms = [s, s.replace(/ies$/, "y"), s.replace(/s$/, "")].filter(
    (f) => f.length >= 4,
  );
  for (const f of forms) {
    if (IGNORE.has(f) || isNotAGenre(f)) return null;
    const hit = ALIAS.get(f);
    if (hit) return hit;
  }

  const cat = allowNew ? categorize(raw) : categorizeStrict(raw);
  if (!cat) return null; // unknown term from a low-trust source — drop it

  return {
    slug: s,
    name: raw.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    category: cat,
  };
}

/* ─────────────────────────── featured genres ─────────────────────────── */

/**
 * Curated set promoted on the homepage grid + genre nav — broad, competitor-
 * style (genre + major fetish + format in one flat list), each with real depth.
 * Everything else stays fully browsable, just not promoted.
 */
export const FEATURED_GENRE_SLUGS = [
  "vanilla", "romance", "comedy", "fantasy", "drama", "harem",
  "school", "milf", "incest", "ntr", "virgin", "teacher", "nurse", "maid",
  "gyaru", "succubus", "monster-girl", "elf", "cosplay", "public", "mind-control",
  "big-breasts", "ahegao", "creampie", "blowjob", "paizuri", "anal", "yuri",
  "futanari", "tentacles", "bondage", "femdom", "group", "ugly-bastard",
  "pregnant", "3d", "rape",
];

const FEATURED_SET = new Set(FEATURED_GENRE_SLUGS);

/** Is this tag slug in the curated homepage-genre set (the default for the
 *  `featured` flag when a tag is first created)? */
export function isFeaturedSlug(slug: string): boolean {
  return FEATURED_SET.has(slug);
}
