import type { Prisma, TagCategory } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { TAG_DICTIONARY } from "@/lib/metadata/tag-dictionary";
import { extractTags, flagsMinor, slugify, matchers } from "@/lib/metadata/tags";
import { isFeaturedSlug } from "@/lib/metadata/tag-canonical";
import {
  getSeason,
  isHentai,
  normalize,
  type NormalizedSeries,
  type MalSeason,
} from "@/lib/metadata/mal";
import { uploadRemoteToR2 } from "@/lib/r2-upload";

/** MAL's raw cover URL, uploaded into our own Cloudinary — never store a
 *  hotlink. Falls back to the raw URL if the upload fails (source down,
 *  Cloudinary hiccup) so a transient failure never loses the cover outright. */
async function resolveCover(rawUrl: string | null, slug: string): Promise<string | null> {
  if (!rawUrl) return null;
  return (await uploadRemoteToR2(rawUrl, "series/covers", slug)) ?? rawUrl;
}

const CAT_BY_NAME = new Map<string, TagCategory>(
  TAG_DICTIONARY.map((t) => [slugify(t.name), t.category]),
);
const NAME_BY_SLUG = new Map<string, string>(
  TAG_DICTIONARY.map((t) => [slugify(t.name), t.name]),
);
const LANDING_BY_SLUG = new Map<string, boolean>(
  TAG_DICTIONARY.map((t) => [slugify(t.name), Boolean(t.landing)]),
);

/** MAL genres worth keeping, mapped to our tag names. */
const MAL_GENRE_MAP: Record<string, { name: string; category: TagCategory }> = {
  "Love Polygon": { name: "Harem", category: "THEME" },
  Harem: { name: "Harem", category: "THEME" },
  "Reverse Harem": { name: "Reverse Harem", category: "THEME" },
  "Girls Love": { name: "Yuri", category: "FETISH" },
  Gore: { name: "Guro", category: "CONTENT_WARNING" },
  Horror: { name: "Horror", category: "GENRE" },
  Comedy: { name: "Comedy", category: "GENRE" },
  Fantasy: { name: "Fantasy", category: "GENRE" },
  "Sci-Fi": { name: "Sci-Fi", category: "GENRE" },
  Romance: { name: "Romance", category: "GENRE" },
  Drama: { name: "Drama", category: "GENRE" },
  "Slice of Life": { name: "Slice of Life", category: "GENRE" },
};

export interface ImportStats {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  flagged: number;
  episodeStubs: number;
  errors: string[];
}

export const emptyImportStats = (): ImportStats => ({
  scanned: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  flagged: 0,
  episodeStubs: 0,
  errors: [],
});
const empty = emptyImportStats;

// in-process caches — a backfill touches the same tags/studios thousands of times
const tagCache = new Map<string, string>();
const studioCache = new Map<string, string>();

async function ensureTag(slug: string, name: string, category: TagCategory) {
  const hit = tagCache.get(slug);
  if (hit) return { id: hit };
  const t = await db(() =>
    prisma.tag.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        category,
        featured: isFeaturedSlug(slug),
        bodyMd: LANDING_BY_SLUG.get(slug)
          ? `${name} hentai — every ${name.toLowerCase()} title on the site, newest first.`
          : null,
      },
      select: { id: true },
    }),
  );
  tagCache.set(slug, t.id);
  return t;
}

async function ensureStudio(name: string) {
  const slug = slugify(name);
  if (!slug) return null;
  const hit = studioCache.get(slug);
  if (hit) return { id: hit };
  const s = await db(() =>
    prisma.studio.upsert({
      where: { slug },
      update: {},
      create: { name, slug, type: "STUDIO" },
      select: { id: true },
    }),
  );
  studioCache.set(slug, s.id);
  return s;
}

/**
 * Create DRAFT episode skeletons 1..count that don't already exist (part 1).
 * MAL only gives an episode count + an average runtime — no per-episode data —
 * so the stub carries just number + runtime. The scraper attaches the real
 * video source later and flips the episode live. Only fills gaps; never
 * removes episodes added by the scraper or an admin.
 */
async function ensureEpisodeStubs(
  seriesId: string,
  count: number | null,
  runtimeSec: number | null,
): Promise<number> {
  if (!count || count < 1) return 0;
  const n = Math.min(Math.floor(count), 60); // guard against bad MAL data

  const have = await db(() =>
    prisma.episode.findMany({
      where: { seriesId, part: 1 },
      select: { number: true },
    }),
  );
  const present = new Set(have.map((e) => e.number));

  const missing: Prisma.EpisodeCreateManyInput[] = [];
  for (let i = 1; i <= n; i++) {
    if (present.has(i)) continue;
    missing.push({
      seriesId,
      number: i,
      part: 1,
      runtimeSec: runtimeSec ?? 0,
      publish: "DRAFT",
    });
  }
  if (!missing.length) return 0;

  await db(() =>
    prisma.episode.createMany({ data: missing, skipDuplicates: true }),
  );
  return missing.length;
}

async function freeSlug(title: string, malId: number): Promise<string> {
  const base = slugify(title).slice(0, 90) || `mal-${malId}`;
  for (let i = 0; i < 40; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db(() =>
      prisma.series.findUnique({
        where: { slug: cand },
        select: { malId: true },
      }),
    );
    if (!existing || existing.malId === malId) return cand;
  }
  return `${base}-${malId}`;
}

/** Upsert one normalized series. Never clobbers admin edits. */
export async function importSeries(
  n: NormalizedSeries,
  stats: ImportStats,
): Promise<void> {
  stats.scanned++;

  const existing = await db(() =>
    prisma.series.findUnique({
      where: { malId: n.malId },
      select: { id: true, slug: true, metadataSource: true, publish: true, coverUrl: true },
    }),
  );

  // an admin-owned row: only fill blanks, never touch tags/publish
  const adminOwned = existing && existing.metadataSource !== "mal";

  const minor = flagsMinor(`${n.title} ${n.synopsis ?? ""}`);
  if (minor) stats.flagged++;

  const contentWarnings = minor ? ["possible-minor"] : [];

  // tags: MAL genres + keyword extraction over title + synopsis
  const tagSlugs = new Set<string>();
  for (const g of n.genreNames) {
    const m = MAL_GENRE_MAP[g];
    if (m) tagSlugs.add(slugify(m.name));
  }
  for (const s of extractTags(n.title, n.synopsis, matchers())) {
    tagSlugs.add(s);
  }
  if (minor) tagSlugs.add(slugify("Rape")); // conservative surface

  const tagIds: string[] = [];
  if (!adminOwned) {
    for (const slug of tagSlugs) {
      const name = NAME_BY_SLUG.get(slug) ?? MAL_GENRE_MAP[slug]?.name;
      const cat = CAT_BY_NAME.get(slug) ?? "THEME";
      if (!name) continue;
      const t = await ensureTag(slug, name, cat);
      tagIds.push(t.id);
    }
  }

  const studio = n.studioNames[0] ? await ensureStudio(n.studioNames[0]) : null;

  const core = {
    title: n.title,
    titleRomaji: n.titleRomaji,
    titleEnglish: n.titleEnglish,
    titleOriginal: n.titleOriginal,
    altTitles: n.altTitles,
    synopsis: n.synopsis,
    type: n.type as Prisma.SeriesCreateInput["type"],
    status: n.status as Prisma.SeriesCreateInput["status"],
    sourceMaterial:
      (n.sourceMaterial as Prisma.SeriesCreateInput["sourceMaterial"]) ?? null,
    year: n.year,
    releaseDate: n.releaseDate,
    animeSeason:
      (n.animeSeason as Prisma.SeriesCreateInput["animeSeason"]) ?? null,
    seasonYear: n.seasonYear,
    totalEpisodes: n.totalEpisodes,
    airDay: (n.airDay as Prisma.SeriesCreateInput["airDay"]) ?? null,
    externalScore: n.externalScore,
    // coverUrl deliberately left out here — it needs the row's slug to pick
    // a Cloudinary public_id, which isn't settled until each branch below
    contentWarnings,
    studioId: studio?.id ?? null,
    metadataSource: "mal",
    metadataSyncedAt: new Date(),
  };

  if (!existing) {
    const slug = await freeSlug(n.title, n.malId);
    const coverUrl = await resolveCover(n.coverUrl, slug);
    const created = await db(() =>
      prisma.series.create({
        data: {
          ...core,
          coverUrl,
          slug,
          malId: n.malId,
          publish: "DRAFT",
          bayesianRating: n.externalScore ?? 0,
          tags: { connect: tagIds.map((id) => ({ id })) },
        },
        select: { id: true },
      }),
    );
    stats.episodeStubs += await ensureEpisodeStubs(
      created.id,
      n.totalEpisodes,
      n.runtimeSec,
    );
    stats.created++;
    return;
  }

  if (adminOwned) {
    // fill only empty columns
    const cur = await db(() =>
      prisma.series.findUnique({
        where: { id: existing.id },
        select: {
          synopsis: true,
          titleOriginal: true,
          titleEnglish: true,
          coverUrl: true,
          year: true,
          releaseDate: true,
          animeSeason: true,
          sourceMaterial: true,
          totalEpisodes: true,
          externalScore: true,
        },
      }),
    );
    const coverUrl = cur?.coverUrl ?? (await resolveCover(n.coverUrl, existing.slug));
    await db(() =>
      prisma.series.update({
        where: { id: existing.id },
        data: {
          synopsis: cur?.synopsis ?? n.synopsis,
          titleOriginal: cur?.titleOriginal ?? n.titleOriginal,
          titleEnglish: cur?.titleEnglish ?? n.titleEnglish,
          coverUrl,
          year: cur?.year ?? n.year,
          releaseDate: cur?.releaseDate ?? n.releaseDate,
          animeSeason:
            cur?.animeSeason ??
            (n.animeSeason as Prisma.SeriesCreateInput["animeSeason"]) ??
            null,
          sourceMaterial:
            cur?.sourceMaterial ??
            (n.sourceMaterial as Prisma.SeriesCreateInput["sourceMaterial"]) ??
            null,
          totalEpisodes: cur?.totalEpisodes ?? n.totalEpisodes,
          externalScore: cur?.externalScore ?? n.externalScore,
          metadataSyncedAt: new Date(),
        },
      }),
    );
    stats.skipped++;
    return;
  }

  // our own metadata row — full refresh. Skip re-uploading a cover we've
  // already migrated to Cloudinary (existing.coverUrl no longer starts with
  // http) — MAL's art for an already-catalogued series essentially never
  // changes, so there's nothing to gain from re-fetching it every sync.
  const coverUrl =
    existing.coverUrl && !existing.coverUrl.startsWith("http")
      ? existing.coverUrl
      : await resolveCover(n.coverUrl, existing.slug);
  await db(() =>
    prisma.series.update({
      where: { id: existing.id },
      data: {
        ...core,
        coverUrl,
        tags: { set: tagIds.map((id) => ({ id })) },
      },
    }),
  );
  stats.episodeStubs += await ensureEpisodeStubs(
    existing.id,
    n.totalEpisodes,
    n.runtimeSec,
  );
  stats.updated++;
}

/** Import one MAL season (hentai only). */
export async function importSeason(
  year: number,
  season: MalSeason,
  stats: ImportStats = empty(),
): Promise<ImportStats> {
  let anime;
  try {
    anime = await getSeason(year, season);
  } catch (err) {
    stats.errors.push(`${year}/${season}: ${(err as Error).message}`);
    return stats;
  }

  for (const a of anime.filter(isHentai)) {
    try {
      await importSeries(normalize(a), stats);
    } catch (err) {
      stats.errors.push(`mal:${a.id} ${a.title}: ${(err as Error).message}`);
    }
    // breathe between titles so the free pooler isn't hammered flat-out
    await new Promise((r) => setTimeout(r, 40));
  }
  return stats;
}

/**
 * Recompute the denormalised `seriesCount` on every tag + studio — as three SQL
 * statements, not one round-trip per row.
 */
export async function recountTaxonomy() {
  await db(() =>
    prisma.$executeRawUnsafe(`
      UPDATE "Tag" t SET "seriesCount" = COALESCE(sub.n, 0)
      FROM (
        SELECT st."B" AS tag_id, count(*)::int AS n
        FROM "_SeriesTags" st
        JOIN "Series" s ON s.id = st."A" AND s.publish = 'PUBLISHED'
        GROUP BY st."B"
      ) sub
      WHERE t.id = sub.tag_id;
    `),
  );
  await db(() =>
    prisma.$executeRawUnsafe(`
      UPDATE "Tag" SET "seriesCount" = 0
      WHERE id NOT IN (
        SELECT DISTINCT st."B" FROM "_SeriesTags" st
        JOIN "Series" s ON s.id = st."A" AND s.publish = 'PUBLISHED'
      );
    `),
  );
  await db(() =>
    prisma.$executeRawUnsafe(`
      UPDATE "Studio" st SET "seriesCount" = (
        SELECT count(*)::int FROM "Series" s
        WHERE s."studioId" = st.id AND s.publish = 'PUBLISHED'
      );
    `),
  );
  await db(() =>
    prisma.$executeRawUnsafe(`
      UPDATE "Character" c SET "seriesCount" = COALESCE(sub.n, 0)
      FROM (
        SELECT sc."A" AS character_id, count(*)::int AS n
        FROM "_SeriesCharacters" sc
        JOIN "Series" s ON s.id = sc."B" AND s.publish = 'PUBLISHED'
        GROUP BY sc."A"
      ) sub
      WHERE c.id = sub.character_id;
    `),
  );
  await db(() =>
    prisma.$executeRawUnsafe(`
      UPDATE "Character" SET "seriesCount" = 0
      WHERE id NOT IN (
        SELECT DISTINCT sc."A" FROM "_SeriesCharacters" sc
        JOIN "Series" s ON s.id = sc."B" AND s.publish = 'PUBLISHED'
      );
    `),
  );
}
