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

/**
 * Keyword-extract tag slugs from a title + synopsis. Each phrase is matched on
 * word boundaries, case-insensitively. Conservative — a phrase must be ≥ 3 chars
 * and appear as a whole word/phrase.
 */
export function extractTags(text: string, tagMatchers: Matchable[]): string[] {
  const hay = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ")} `;
  const hits = new Set<string>();

  for (const t of tagMatchers) {
    const phrases = [t.name, ...t.synonyms].map((p) => p.toLowerCase().trim());
    for (const p of phrases) {
      if (p.length < 3) continue;
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?:^|[^\\p{L}])${esc}(?:$|[^\\p{L}])`, "u");
      if (re.test(hay)) {
        hits.add(t.slug);
        break;
      }
    }
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
