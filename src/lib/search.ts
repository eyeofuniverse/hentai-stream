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

async function seriesSearch(term: string, limit: number): Promise<SeriesHit[]> {
  const q = term.slice(0, 120);
  const prefix = `${q}%`;
  const infix = `%${q}%`;
  return db(() =>
    prisma.$queryRaw<RawSeries[]>(Prisma.sql`
      SELECT s.id, s.slug, s.title, s."titleEnglish", s."coverUrl", s.year,
             s.type::text AS type, s.status::text AS status, s.synopsis,
             (SELECT count(*)::int FROM "Episode" e
                WHERE e."seriesId" = s.id AND e.publish = 'PUBLISHED') AS episodes,
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
  const [series, tags] = await Promise.all([
    seriesSearch(term, 7),
    tagSearch(term, 4),
  ]);
  return { series, tags };
}

/** Full results for the /search page. */
export async function searchResults(q: string) {
  const term = q.trim();
  if (term.length < 2) return { series: [] as SeriesHit[], tags: [] as TagHit[] };
  const [series, tags] = await Promise.all([
    seriesSearch(term, 48),
    tagSearch(term, 12),
  ]);
  return { series, tags };
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
