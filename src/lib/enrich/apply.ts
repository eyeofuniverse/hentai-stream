import { prisma, db } from "@/lib/db";
import { slugify } from "@/lib/metadata/tags";
import { canonicalTag, isFeaturedSlug } from "@/lib/metadata/tag-canonical";
import { uploadRemoteToR2 } from "@/lib/r2-upload";
import type { EnrichResult } from "./types";

export interface ApplyStats {
  fieldsFilled: number;
  tagsAdded: number;
  charactersAdded: number;
}

const EXTERNAL_COL: Record<string, "anilistId" | "nhentaiId" | "hanimeSlug" | "anidbId"> = {
  anilist: "anilistId",
  nhentai: "nhentaiId",
  hanime: "hanimeSlug",
  anidb: "anidbId",
};

/**
 * Merge one enricher's result onto a Series — non-destructively. Series columns
 * are only filled when empty (and never on a hand-edited row). Tags, characters
 * and episode text are additive: we connect what's new, never remove.
 */
export async function applyEnrichment(
  seriesId: string,
  source: string,
  r: EnrichResult,
): Promise<ApplyStats> {
  const stats: ApplyStats = { fieldsFilled: 0, tagsAdded: 0, charactersAdded: 0 };
  if (!r.matched) return stats;

  const cur = await db(() =>
    prisma.series.findUnique({
      where: { id: seriesId },
      select: {
        slug: true,
        metadataSource: true,
        titleEnglish: true,
        titleOriginal: true,
        titleRomaji: true,
        synopsis: true,
        coverUrl: true,
        bannerUrl: true,
        studioId: true,
        externalScore: true,
        year: true,
        releaseDate: true,
        artist: true,
        parody: true,
        altTitles: true,
      },
    }),
  );
  if (!cur) return stats;

  const data: Record<string, unknown> = {};
  const col = EXTERNAL_COL[source];
  if (col && r.externalId != null) {
    data[col] = col === "hanimeSlug" ? String(r.externalId) : Number(r.externalId);
  }

  // series columns — only when the row isn't hand-managed and the field is empty
  if (cur.metadataSource !== "manual" && r.series) {
    const s = r.series;
    const fill = (key: string, val: unknown, empty: boolean) => {
      if (val != null && val !== "" && empty) {
        data[key] = val;
        stats.fieldsFilled++;
      }
    };
    fill("titleEnglish", s.titleEnglish, !cur.titleEnglish);
    fill("titleOriginal", s.titleOriginal, !cur.titleOriginal);
    fill("titleRomaji", s.titleRomaji, !cur.titleRomaji);
    fill("synopsis", s.synopsis, !cur.synopsis);
    // covers/banners go through Cloudinary, never stored as a raw hotlink
    if (s.coverUrl && !cur.coverUrl) {
      data.coverUrl = (await uploadRemoteToR2(s.coverUrl, "series/covers", cur.slug)) ?? s.coverUrl;
      stats.fieldsFilled++;
    }
    if (s.bannerUrl && !cur.bannerUrl) {
      data.bannerUrl =
        (await uploadRemoteToR2(s.bannerUrl, "series/banners", cur.slug)) ?? s.bannerUrl;
      stats.fieldsFilled++;
    }
    fill("externalScore", s.externalScore, cur.externalScore == null);
    fill("year", s.year, cur.year == null);
    fill("releaseDate", s.releaseDate, cur.releaseDate == null);
    // censorship: external sources are authoritative, always apply when given
    if (typeof s.isCensored === "boolean") {
      data.isCensored = s.isCensored;
      stats.fieldsFilled++;
    }
    if (s.studioName && !cur.studioId) {
      const st = await db(() =>
        prisma.studio.upsert({
          where: { slug: slugify(s.studioName!) },
          update: {},
          create: { name: s.studioName!, slug: slugify(s.studioName!), type: "STUDIO" },
          select: { id: true },
        }),
      );
      data.studioId = st.id;
      stats.fieldsFilled++;
    }
  }

  if (r.artist && !cur.artist) {
    data.artist = r.artist;
    stats.fieldsFilled++;
  }
  if (r.parody && !cur.parody) {
    data.parody = r.parody;
    stats.fieldsFilled++;
    if (!cur.altTitles.includes(r.parody))
      data.altTitles = [...cur.altTitles, r.parody];
  }

  // tags — additive, canonicalised (dictionary aliases collapse onto one tag)
  if (r.tags?.length) {
    const ids = new Set<string>();
    for (const raw of r.tags) {
      // low-trust source — only dictionary + recognised content terms
      const canon = canonicalTag(raw, { allowNew: false });
      if (!canon) continue;
      const t = await db(() =>
        prisma.tag.upsert({
          where: { slug: canon.slug },
          update: {},
          create: {
            slug: canon.slug,
            name: canon.name,
            category: canon.category,
            featured: isFeaturedSlug(canon.slug),
          },
          select: { id: true },
        }),
      );
      ids.add(t.id);
    }
    if (ids.size) {
      data.tags = { connect: [...ids].map((id) => ({ id })) };
      stats.tagsAdded += ids.size;
    }
  }

  // characters — additive; image/description backfilled whenever the source has one
  if (r.characters?.length) {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const raw of r.characters) {
      const c = typeof raw === "string" ? { name: raw } : raw;
      const name = c.name?.trim();
      if (!name) continue;
      const slug = slugify(name);
      if (slug.length < 2 || seen.has(slug)) continue;
      seen.add(slug);

      // avoid re-fetching + re-uploading on every weekly re-run: only touch
      // image/description when this character doesn't already have one
      const existing = await db(() =>
        prisma.character.findUnique({
          where: { slug },
          select: { id: true, imageUrl: true, description: true },
        }),
      );
      const imageUrl =
        c.imageUrl && !existing?.imageUrl
          ? ((await uploadRemoteToR2(c.imageUrl, "characters", slug)) ?? c.imageUrl)
          : null;
      const description = c.description && !existing?.description ? c.description : null;
      const row = await db(() =>
        prisma.character.upsert({
          where: { slug },
          update: {
            ...(imageUrl ? { imageUrl } : {}),
            ...(description ? { description } : {}),
          },
          create: { slug, name, imageUrl, description },
          select: { id: true },
        }),
      );
      ids.push(row.id);
    }
    if (ids.length) {
      data.characters = { connect: ids.map((id) => ({ id })) };
      stats.charactersAdded += ids.length;
    }
  }

  if (Object.keys(data).length) {
    await db(() => prisma.series.update({ where: { id: seriesId }, data }));
  }

  // per-episode text — fill blanks only
  for (const ep of r.episodes ?? []) {
    const part = ep.part && ep.part > 0 ? ep.part : 1;
    const existing = await db(() =>
      prisma.episode.findUnique({
        where: { seriesId_number_part: { seriesId, number: ep.number, part } },
        select: { id: true, title: true, synopsis: true, thumbUrl: true, airedAt: true },
      }),
    );
    const epData: Record<string, unknown> = {};
    if (ep.title && !existing?.title) epData.title = ep.title;
    if (ep.synopsis && !existing?.synopsis) epData.synopsis = ep.synopsis;
    if (ep.thumbUrl && !existing?.thumbUrl) epData.thumbUrl = ep.thumbUrl;
    if (ep.airedAt && !existing?.airedAt) {
      const d = new Date(ep.airedAt);
      if (!Number.isNaN(d.getTime())) epData.airedAt = d;
    }
    if (!Object.keys(epData).length) continue;
    await db(() =>
      prisma.episode.upsert({
        where: { seriesId_number_part: { seriesId, number: ep.number, part } },
        create: { seriesId, number: ep.number, part, publish: "DRAFT", ...epData },
        update: epData,
      }),
    );
    stats.fieldsFilled += Object.keys(epData).length;
  }

  return stats;
}
