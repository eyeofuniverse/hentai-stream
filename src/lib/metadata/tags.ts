import { TAG_DICTIONARY, MINOR_FLAG_TERMS } from "@/lib/metadata/tag-dictionary";

type Matchable = { slug: string; name: string; synonyms: string[] };

/** Build the matcher list from DB tags (falls back to the static dictionary). */
export function matchers(dbTags?: Matchable[]): Matchable[] {
  if (dbTags && dbTags.length) return dbTags;
  return TAG_DICTIONARY.map((t) => ({
    slug: slugify(t.name),
    name: t.name,
    synonyms: t.synonyms ?? [],
  }));
}

const LANDING_SLUGS = new Set(
  TAG_DICTIONARY.filter((t) => t.landing).map((t) => slugify(t.name)),
);

const clean = (s: string) =>
  ` ${s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ")} `;

function phraseHits(hay: string, t: Matchable): boolean {
  for (const p of [t.name, ...t.synonyms].map((x) => x.toLowerCase().trim())) {
    if (p.length < 3) continue;
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^\\p{L}])${esc}(?:$|[^\\p{L}])`, "u").test(hay)) return true;
  }
  return false;
}

/**
 * Keyword-extract tag slugs from a title + synopsis.
 *   - a match in the **title** counts for any tag (strong signal)
 *   - a match in the **synopsis** only counts for a curated `landing` tag —
 *     niche fetish tags need a real source (scraper genres / enrich), not prose
 * Phrases match on word boundaries, case-insensitively, ≥ 3 chars.
 */
export function extractTags(
  title: string,
  synopsis: string | null,
  tagMatchers: Matchable[],
): string[] {
  const titleHay = clean(title);
  const synHay = clean(synopsis ?? "");
  const hits = new Set<string>();

  for (const t of tagMatchers) {
    if (phraseHits(titleHay, t)) hits.add(t.slug);
    else if (LANDING_SLUGS.has(t.slug) && phraseHits(synHay, t)) hits.add(t.slug);
  }
  return [...hits];
}

/** True if the text hints at apparent-minor content — hold for manual review. */
export function flagsMinor(text: string): boolean {
  const hay = text.toLowerCase();
  return MINOR_FLAG_TERMS.some((w) => hay.includes(w));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}
