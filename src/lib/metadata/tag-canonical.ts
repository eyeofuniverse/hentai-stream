import type { TagCategory } from "@prisma/client";
import { TAG_DICTIONARY } from "./tag-dictionary";
import { slugify } from "./tags";

export type CanonicalTag = { slug: string; name: string; category: TagCategory };

/* ─────────────────────────── categorisation ─────────────────────────── */

const DICT_CAT = new Map<string, TagCategory>(
  TAG_DICTIONARY.flatMap((t) => [
    [slugify(t.name), t.category] as const,
    ...(t.synonyms ?? []).map((s) => [slugify(s), t.category] as const),
  ]),
);

const CW =
  /\b(rape|non[- ]?con|guro|gore|scat|vore|snuff|ryona|torture|bestial|necro|drug|abuse|violat)/i;
const FETISH =
  /\b(creampie|nakadashi|paizuri|titf|boobjob|ahegao|bukkake|gokkun|gangbang|orgy|ntr|netorare|netori|anal|footjob|handjob|blowjob|deepthroat|fellatio|irrumatio|cunnilingus|rimjob|squirt|lactation|tentacle|futanari|yuri|yaoi|femdom|maledom|bondage|bdsm|exhibition|x[- ]?ray|double penetration|spitroast|facesit|pregnant|impregnation|urination|enema|prolapse|fisting|threesome|groupsex|group sex)/i;
const FORMAT = /\b(3d|3dcg|cgi|cg|flash|motion anime|motion comic|live action)\b/i;
const GENRE =
  /\b(comedy|drama|romance|fantasy|sci[- ]?fi|horror|action|mystery|slice of life|vanilla|isekai|adventure)\b/i;

/** Best-guess a category for a tag name coming from an external source. */
export function categorize(name: string): TagCategory {
  const known = DICT_CAT.get(slugify(name));
  if (known) return known;
  if (CW.test(name)) return "CONTENT_WARNING";
  if (FORMAT.test(name)) return "FORMAT";
  if (FETISH.test(name)) return "FETISH";
  if (GENRE.test(name)) return "GENRE";
  return "THEME";
}

/* ─────────────────────────── canonicalisation ─────────────────────────── */

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

/** If this slug is a known dictionary alias, the canonical tag it maps to. */
export function aliasToCanonical(slug: string): CanonicalTag | null {
  return ALIAS.get(slug) ?? null;
}

/**
 * Resolve any raw tag string to the tag we should actually store. Dictionary
 * names and synonyms collapse onto one canonical tag; an unknown tag keeps its
 * own slug with a best-guess category. Returns null for junk (< 2 chars).
 */
export function canonicalTag(raw: string): CanonicalTag | null {
  const s = slugify(raw.trim());
  if (s.length < 2) return null;
  const hit = ALIAS.get(s);
  if (hit) return hit;
  return {
    slug: s,
    name: raw.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    category: categorize(raw),
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
