import { Prisma } from "@prisma/client";
import { prisma, db } from "@/lib/db";

/** Canonical form of a query term for analytics keys + tag matching. */
export function normalizeTerm(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export type SeriesHit = {
  id: string;
  slug: string;
  title: string;
  titleEnglish: string | null;
  coverUrl: string | null;
  year: number | null;
  type: string;
  status: string;
  synopsis: string | null;
  episodes: number;
};

export type TagHit = {
  slug: string;
  name: string;
  category: string;
  seriesCount: number;
};

type RawSeries = Omit<SeriesHit, "episodes"> & { episodes: number };

async function seriesSearch(
  term: string,
  limit: number,
  withCounts: boolean,
): Promise<SeriesHit[]> {
  const q = term.slice(0, 120);
  const prefix = `${q}%`;
  const infix = `%${q}%`;
  const episodesCol = withCounts
    ? Prisma.sql`(SELECT count(*)::int FROM "Episode" e WHERE e."seriesId" = s.id AND e.publish = 'PUBLISHED' AND e.kind = 'MAIN')`
    : Prisma.sql`0`;
  return db(() =>
    prisma.$queryRaw<RawSeries[]>(Prisma.sql`
      SELECT s.id, s.slug, s.title, s."titleEnglish", s."coverUrl", s.year,
             s.type::text AS type, s.status::text AS status, s.synopsis,
             ${episodesCol} AS episodes,
             GREATEST(
               similarity(s.title, ${q}),
               similarity(coalesce(s."titleEnglish", ''), ${q}),
               similarity(coalesce(s."titleRomaji", ''), ${q})
             ) AS sim,
             (s.title ILIKE ${prefix} OR s."titleEnglish" ILIKE ${prefix}) AS is_prefix
      FROM "Series" s
      WHERE s.publish = 'PUBLISHED'
        AND (
          s.title % ${q} OR s."titleEnglish" % ${q} OR s."titleRomaji" % ${q}
          OR s.title ILIKE ${infix} OR s."titleEnglish" ILIKE ${infix}
          OR ${q} = ANY(s."altTitles")
        )
      ORDER BY is_prefix DESC, sim DESC, s."viewCount" DESC
      LIMIT ${limit}
    `),
  ).catch(() => [] as RawSeries[]);
}

/** Series that don't match by title/synopsis at all, but carry a tag/genre
 *  matching the term (e.g. searching "MILF" should surface series tagged
 *  MILF even when the word never appears in the title). */
async function seriesByTagSearch(
  term: string,
  limit: number,
  withCounts: boolean,
): Promise<SeriesHit[]> {
  const q = term.slice(0, 120);
  const infix = `%${q}%`;
  const episodesCol = withCounts
    ? Prisma.sql`(SELECT count(*)::int FROM "Episode" e WHERE e."seriesId" = s.id AND e.publish = 'PUBLISHED' AND e.kind = 'MAIN')`
    : Prisma.sql`0`;
  return db(() =>
    prisma.$queryRaw<RawSeries[]>(Prisma.sql`
      SELECT s.id, s.slug, s.title, s."titleEnglish", s."coverUrl", s.year,
             s.type::text AS type, s.status::text AS status, s.synopsis,
             ${episodesCol} AS episodes
      FROM "Series" s
      WHERE s.publish = 'PUBLISHED'
        AND EXISTS (
          SELECT 1 FROM "_SeriesTags" st
          JOIN "Tag" t ON t.id = st."B"
          WHERE st."A" = s.id
            AND (t.name ILIKE ${infix} OR t.slug ILIKE ${infix} OR ${q} = ANY(t.synonyms))
        )
      ORDER BY s."viewCount" DESC
      LIMIT ${limit}
    `),
  ).catch(() => [] as RawSeries[]);
}

/** Each source's hits win in order (earlier = more precise intent), deduped
 *  so a series matching more than one source isn't repeated. */
function mergeSeriesHits(sources: SeriesHit[][], limit: number): SeriesHit[] {
  const merged: SeriesHit[] = [];
  const seen = new Set<string>();
  for (const hits of sources) {
    for (const s of hits) {
      if (merged.length >= limit) return merged;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
  }
  return merged;
}

/** Bare 4-digit queries ("2026", "2020") never match anything in
 *  seriesSearch — trigram similarity against a title almost never fires for
 *  a lone year, since titles rarely contain the number as a standalone
 *  token, so a search for a release year returned zero results even when
 *  the catalogue had dozens of matching series. Matches Series.year
 *  directly instead of treating the query as title text. */
const YEAR_RE = /^(19[6-9]\d|20[0-3]\d)$/;

async function seriesByYearSearch(
  term: string,
  limit: number,
  withCounts: boolean,
): Promise<SeriesHit[]> {
  const match = term.match(YEAR_RE);
  if (!match) return [];
  const year = Number(match[0]);
  const episodesCol = withCounts
    ? Prisma.sql`(SELECT count(*)::int FROM "Episode" e WHERE e."seriesId" = s.id AND e.publish = 'PUBLISHED' AND e.kind = 'MAIN')`
    : Prisma.sql`0`;
  return db(() =>
    prisma.$queryRaw<RawSeries[]>(Prisma.sql`
      SELECT s.id, s.slug, s.title, s."titleEnglish", s."coverUrl", s.year,
             s.type::text AS type, s.status::text AS status, s.synopsis,
             ${episodesCol} AS episodes
      FROM "Series" s
      WHERE s.publish = 'PUBLISHED' AND s.year = ${year}
      ORDER BY s."bayesianRating" DESC, s."viewCount" DESC
      LIMIT ${limit}
    `),
  ).catch(() => [] as RawSeries[]);
}

async function tagSearch(term: string, limit: number): Promise<TagHit[]> {
  const rows = await db(() =>
    prisma.tag.findMany({
      where: {
        seriesCount: { gt: 0 },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term.replace(/\s+/g, "-"), mode: "insensitive" } },
          { synonyms: { hasSome: [term, ...term.split(" ")] } },
        ],
      },
      orderBy: { seriesCount: "desc" },
      take: limit,
      select: { slug: true, name: true, category: true, seriesCount: true },
    }),
  ).catch(() => []);
  return rows.map((t) => ({ ...t, category: String(t.category) }));
}

/** Fast typeahead — series + tags, small result sets. No analytics. */
export async function searchSuggest(q: string) {
  const term = q.trim();
  if (term.length < 2) return { series: [] as SeriesHit[], tags: [] as TagHit[] };
  const LIMIT = 7;
  const [titleHits, yearHits, tagHits, tags] = await Promise.all([
    seriesSearch(term, LIMIT, false),
    seriesByYearSearch(term, LIMIT, false),
    seriesByTagSearch(term, LIMIT, false),
    tagSearch(term, 4),
  ]);
  return { series: mergeSeriesHits([titleHits, yearHits, tagHits], LIMIT), tags };
}

/** Full results for the /search page. */
export async function searchResults(q: string) {
  const term = q.trim();
  if (term.length < 2) return { series: [] as SeriesHit[], tags: [] as TagHit[] };
  const LIMIT = 48;
  const [titleHits, yearHits, tagHits, tags] = await Promise.all([
    seriesSearch(term, LIMIT, true),
    seriesByYearSearch(term, LIMIT, true),
    seriesByTagSearch(term, LIMIT, true),
    tagSearch(term, 12),
  ]);
  return { series: mergeSeriesHits([titleHits, yearHits, tagHits], LIMIT), tags };
}

/**
 * Record one committed search for analytics. Fire-and-forget: never throws into
 * the caller. `topSeries` is the result the searcher most likely wanted (the #1
 * hit, or the suggestion they clicked).
 */
export async function recordSearch(opts: {
  raw: string;
  resultCount: number;
  topSeries?: { id: string; title: string } | null;
}): Promise<void> {
  const term = normalizeTerm(opts.raw);
  if (term.length < 2 || term.length > 80) return;
  const sample = opts.raw.trim().slice(0, 120);
  const zero = opts.resultCount === 0 ? 1 : 0;

  try {
    const tag = await db(() =>
      prisma.tag.findFirst({
        where: {
          OR: [
            { slug: term.replace(/\s+/g, "-") },
            { name: { equals: term, mode: "insensitive" } },
            { synonyms: { has: term } },
          ],
        },
        select: { slug: true },
      }),
    );

    await db(() =>
      prisma.searchTermStat.upsert({
        where: { term },
        create: {
          term,
          sample,
          count: 1,
          lastResultCount: opts.resultCount,
          zeroHitCount: zero,
          topSeriesId: opts.topSeries?.id ?? null,
          topSeriesTitle: opts.topSeries?.title ?? null,
          matchedTagSlug: tag?.slug ?? null,
        },
        update: {
          sample,
          count: { increment: 1 },
          lastResultCount: opts.resultCount,
          zeroHitCount: { increment: zero },
          topSeriesId: opts.topSeries?.id ?? null,
          topSeriesTitle: opts.topSeries?.title ?? null,
          matchedTagSlug: tag?.slug ?? null,
          lastSearchedAt: new Date(),
        },
      }),
    );
  } catch {
    /* analytics must never break search */
  }
}

/** Popular real searches (have results) — for the "related searches" block. */
export async function popularSearches(limit = 12) {
  return db(() =>
    prisma.searchTermStat.findMany({
      where: { lastResultCount: { gt: 0 }, count: { gt: 1 } },
      orderBy: { count: "desc" },
      take: limit,
      select: { term: true, sample: true, count: true },
    }),
  ).catch(() => []);
}
