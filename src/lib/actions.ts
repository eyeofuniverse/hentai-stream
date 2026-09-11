"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import slugify from "slugify";
import { z } from "zod";
import { prisma, db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { pingIndexNow } from "@/lib/indexnow";
import { canonicalTag, isFeaturedSlug } from "@/lib/metadata/tag-canonical";
import { Prisma } from "@prisma/client";
import type {
  AnimeSeason,
  PublishStatus,
  SourceMaterial,
  SourceStatus,
  Weekday,
} from "@prisma/client";

type Tx = Prisma.TransactionClient;

const slug = (s: string) => slugify(s, { lower: true, strict: true });
const csv = (v?: string) =>
  v ? [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))] : [];

/** Bust the public ISR cache for a series + its shared pages, and tell the
 *  search engines (IndexNow) what changed. */
async function bust(seriesId?: string) {
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/tags");
  revalidatePath("/calendar");
  if (seriesId) {
    const s = await prisma.series
      .findUnique({
        where: { id: seriesId },
        select: {
          slug: true,
          publish: true,
          episodes: { where: { publish: "PUBLISHED" }, select: { number: true } },
        },
      })
      .catch(() => null);
    if (s) {
      revalidatePath(`/hentai/${s.slug}`);
      revalidatePath(`/hentai/${s.slug}`, "layout");
      if (s.publish === "PUBLISHED") {
        const urls = [
          `/hentai/${s.slug}`,
          ...s.episodes.map((e) => `/hentai/${s.slug}/${e.number}`),
        ];
        // run after the response so the serverless function doesn't freeze
        // mid-fetch and silently drop the ping
        after(() => pingIndexNow(urls));
      }
    }
  }
}

// ─────────── series ───────────

const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
const optStr = z.preprocess(blank, z.string().max(4000).optional());
const optInt = z.preprocess(blank, z.coerce.number().int().optional());
const optEnum = <T extends [string, ...string[]]>(vals: T) =>
  z.preprocess(blank, z.enum(vals).optional());

const seriesSchema = z.object({
  title: z.string().min(2).max(200),
  titleEnglish: optStr,
  titleRomaji: optStr,
  titleOriginal: optStr,
  altTitles: optStr,
  synopsis: optStr,
  coverUrl: optStr,
  bannerUrl: optStr,
  tags: optStr,
  contentWarnings: optStr,
  type: z.enum(["OVA", "ONA", "MOVIE", "SPECIAL", "SERIES"]),
  status: z.enum(["ANNOUNCED", "ONGOING", "COMPLETED", "HIATUS"]),
  sourceMaterial: optEnum([
    "ORIGINAL", "MANGA", "GAME", "VISUAL_NOVEL", "LIGHT_NOVEL", "DOUJINSHI", "OTHER",
  ]),
  animeSeason: optEnum(["WINTER", "SPRING", "SUMMER", "FALL"]),
  airDay: optEnum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  year: optInt,
  seasonYear: optInt,
  totalEpisodes: optInt,
  featuredRank: optInt,
  isCensored: z.coerce.boolean().optional(),
  studioName: optStr,
  publish: z.enum(["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "HIDDEN"]).optional(),
});

/** Map validated form data to the columns create + update share. */
function seriesData(d: z.infer<typeof seriesSchema>, studioId: string | null) {
  return {
    title: d.title,
    titleEnglish: d.titleEnglish ?? null,
    titleRomaji: d.titleRomaji ?? null,
    titleOriginal: d.titleOriginal ?? null,
    altTitles: csv(d.altTitles),
    synopsis: d.synopsis ?? null,
    coverUrl: d.coverUrl ?? null,
    bannerUrl: d.bannerUrl ?? null,
    contentWarnings: csv(d.contentWarnings),
    type: d.type,
    status: d.status,
    sourceMaterial: (d.sourceMaterial as SourceMaterial | undefined) ?? null,
    animeSeason: (d.animeSeason as AnimeSeason | undefined) ?? null,
    airDay: (d.airDay as Weekday | undefined) ?? null,
    year: d.year ?? null,
    seasonYear: d.seasonYear ?? null,
    totalEpisodes: d.totalEpisodes ?? null,
    featuredRank: d.featuredRank ?? null,
    isCensored: d.isCensored ?? true,
    studioId,
  };
}

async function resolveStudio(tx: Tx, name?: string) {
  if (!name?.trim()) return null;
  const s = name.trim();
  return tx.studio.upsert({
    where: { slug: slug(s) },
    update: {},
    create: { name: s, slug: slug(s) },
  });
}

async function resolveTags(tx: Tx, list: string[]) {
  const tags = [];
  for (const raw of list) {
    // route through the canonical dictionary so an admin typo / alias collapses
    // onto the existing tag and the category / featured flag are set
    const canon = canonicalTag(raw);
    const name = canon?.name ?? raw.trim();
    const s = canon?.slug ?? slug(raw);
    if (!s) continue;
    tags.push(
      await tx.tag.upsert({
        where: { slug: s },
        update: {},
        create: {
          name,
          slug: s,
          ...(canon
            ? { category: canon.category, featured: isFeaturedSlug(s) }
            : {}),
        },
        select: { id: true },
      }),
    );
  }
  return tags;
}

export async function createSeries(form: FormData) {
  await requireAdmin();
  const d = seriesSchema.parse(Object.fromEntries(form));

  // studio upsert + tag upserts + the series insert land together or not at all,
  // so a transient failure mid-sequence can't leave an orphan studio/tag or a
  // half-built series
  const id = await db(() =>
    prisma.$transaction(
      async (tx) => {
        const studio = await resolveStudio(tx, d.studioName);
        const tags = await resolveTags(tx, csv(d.tags));

        const base = slug(d.title);
        let s = base;
        for (
          let i = 2;
          await tx.series.findUnique({ where: { slug: s }, select: { id: true } });
          i++
        )
          s = `${base}-${i}`;

        const created = await tx.series.create({
          data: {
            ...seriesData(d, studio?.id ?? null),
            slug: s,
            publish: d.publish ?? "DRAFT",
            metadataSource: "manual",
            tags: { connect: tags.map((t) => ({ id: t.id })) },
          },
          select: { id: true },
        });
        return created.id;
      },
      { timeout: 20_000 },
    ),
  );

  revalidatePath("/console");
  revalidatePath("/console/series");
  await bust(id);
  return id;
}

export async function updateSeries(id: string, form: FormData) {
  await requireAdmin();
  const d = seriesSchema.parse(Object.fromEntries(form));

  await db(() =>
    prisma.$transaction(
      async (tx) => {
        const studio = await resolveStudio(tx, d.studioName);
        const tags = await resolveTags(tx, csv(d.tags));

        await tx.series.update({
          where: { id },
          data: {
            ...seriesData(d, studio?.id ?? null),
            publish: d.publish ?? undefined,
            tags: { set: tags.map((t) => ({ id: t.id })) },
            // a hand-edit takes the row out of the auto-sync's write path
            metadataSource: "manual",
          },
        });
      },
      { timeout: 20_000 },
    ),
  );

  revalidatePath(`/console/series/${id}`);
  revalidatePath("/console/series");
  await bust(id);
}

/** Quick publish-state change from the series list / editor header. */
export async function setSeriesPublish(id: string, publish: PublishStatus) {
  await requireAdmin();
  await prisma.series.update({ where: { id }, data: { publish } });
  revalidatePath("/console/series");
  revalidatePath(`/console/series/${id}`);
  await bust(id);
}

export async function deleteSeries(id: string) {
  await requireAdmin("ADMIN");
  const s = await prisma.series.findUnique({
    where: { id },
    select: { slug: true, episodes: { select: { bunnyGuid: true } } },
  });
  // Prisma cascades the DB rows, but Bunny has no idea any of this happened —
  // its videos are a separate, billed resource that just sits there forever
  // unless we explicitly tell it to delete each one first.
  const guids = s?.episodes.map((e) => e.bunnyGuid).filter((g): g is string => !!g) ?? [];
  if (guids.length) {
    const { deleteVideo } = await import("@/lib/hosting/bunny");
    await Promise.all(guids.map((g) => deleteVideo(g).catch(() => {})));
  }
  await prisma.series.delete({ where: { id } });
  revalidatePath("/console/series");
  if (s) revalidatePath(`/hentai/${s.slug}`);
  await bust();
}

export async function deleteEpisode(id: string) {
  await requireAdmin();
  const before = await prisma.episode
    .findUnique({ where: { id }, select: { bunnyGuid: true } })
    .catch(() => null);
  if (before?.bunnyGuid) {
    const { deleteVideo } = await import("@/lib/hosting/bunny");
    await deleteVideo(before.bunnyGuid).catch(() => {});
  }
  const e = await prisma.episode.delete({
    where: { id },
    select: { seriesId: true },
  });
  revalidatePath(`/console/series/${e.seriesId}`);
  await bust(e.seriesId);
}

/** Review-queue decision on a `possible-minor`-flagged series. */
export async function reviewFlag(id: string, decision: "clear" | "reject") {
  await requireAdmin();
  const s = await prisma.series.findUnique({
    where: { id },
    select: { contentWarnings: true },
  });
  if (!s) return;
  await prisma.series.update({
    where: { id },
    data:
      decision === "reject"
        ? { publish: "REJECTED" }
        : {
            contentWarnings: s.contentWarnings.filter((w) => w !== "possible-minor"),
          },
  });
  revalidatePath("/console/review");
  revalidatePath(`/console/series/${id}`);
  await bust(id);
}

// ─────────── episodes ───────────

const episodeSchema = z.object({
  number: z.coerce.number().int().min(0).max(9999),
  part: z.preprocess((v) => blank(v) ?? 1, z.coerce.number().int().min(1).max(99)),
  title: z.preprocess(blank, z.string().max(300).optional()),
  runtimeSec: z.preprocess(blank, z.coerce.number().int().min(0).max(86_400).optional()),
});

export async function createEpisode(seriesId: string, form: FormData) {
  await requireAdmin();
  const { number, part, title, runtimeSec } = episodeSchema.parse(
    Object.fromEntries(form),
  );

  await prisma.episode.upsert({
    where: { seriesId_number_part: { seriesId, number, part } },
    update: {
      title: title ?? null,
      runtimeSec: runtimeSec ?? undefined,
    },
    create: {
      seriesId,
      number,
      part,
      title: title ?? null,
      runtimeSec: runtimeSec ?? 0,
      publish: "PUBLISHED",
    },
  });
  await prisma.series.update({ where: { id: seriesId }, data: { updatedAt: new Date() } });
  revalidatePath(`/console/series/${seriesId}`);
  await bust(seriesId);
}

// ─────────── sources ───────────

const HOSTS = [
  "STREAMTAPE", "DOODSTREAM", "MIXDROP", "VOE", "STREAMWISH", "FILEMOON",
  "MP4UPLOAD", "VIDGUARD", "LULUSTREAM", "BIGWARP", "YOURUPLOAD", "OTHER",
] as const;

const sourceSchema = z.object({
  host: z.enum(HOSTS),
  hostName: z.string().max(60).optional(),
  embedUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL"),
  label: z.string().max(40).optional(),
  kind: z.enum(["SUB", "DUB", "RAW"]),
  language: z.string().min(2).max(8),
  quality: z.enum(["Q360", "Q480", "Q720", "Q1080", "Q2160", "UNKNOWN"]).default("UNKNOWN"),
});

async function seriesIdForEpisode(episodeId: string) {
  return (
    await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { seriesId: true },
    })
  )?.seriesId;
}

export async function createSource(episodeId: string, form: FormData) {
  await requireAdmin();
  const d = sourceSchema.parse(Object.fromEntries(form));
  const fields = {
    hostName: d.host === "OTHER" ? (d.hostName ?? null) : null,
    label: d.label ?? null,
    kind: d.kind,
    language: d.language,
    quality: d.quality,
    status: "ACTIVE" as const,
  };
  await prisma.videoSource.upsert({
    where: { episodeId_host_embedUrl: { episodeId, host: d.host, embedUrl: d.embedUrl } },
    update: fields,
    create: { episodeId, host: d.host, embedUrl: d.embedUrl, ...fields },
  });
  revalidatePath("/console");
  await bust(await seriesIdForEpisode(episodeId));
}

export async function setSourceStatus(id: string, status: SourceStatus) {
  await requireAdmin();
  const src = await prisma.videoSource.update({
    where: { id },
    data: { status, lastCheckedAt: new Date() },
    select: { episodeId: true },
  });
  revalidatePath("/console");
  await bust(await seriesIdForEpisode(src.episodeId));
}

export async function setPublish(
  kind: "series" | "episode",
  id: string,
  publish: PublishStatus,
) {
  await requireAdmin();
  let seriesId: string | undefined = id;
  if (kind === "series") {
    await prisma.series.update({ where: { id }, data: { publish } });
  } else {
    const e = await prisma.episode.update({
      where: { id },
      data: { publish },
      select: { seriesId: true },
    });
    seriesId = e.seriesId;
  }
  revalidatePath("/console");
  await bust(seriesId);
}

/** Torrent-grabbed episode passed spot-check → clear the hold and publish it. */
export async function approveTorrentEpisode(id: string) {
  await requireAdmin();
  const e = await prisma.episode.update({
    where: { id },
    data: { needsReview: false },
    select: { seriesId: true },
  });
  const { publishIfLive } = await import("@/lib/verify");
  await publishIfLive(id).catch(() => {});
  revalidatePath("/console/review");
  await bust(e.seriesId);
}

/** Torrent grab was wrong (bad episode / language / quality) → bin the Bunny
 *  copy and leave the episode without a source. */
export async function rejectTorrentEpisode(id: string) {
  await requireAdmin();
  const e = await prisma.episode.findUnique({
    where: { id },
    select: { seriesId: true, bunnyGuid: true },
  });
  if (e?.bunnyGuid) {
    const { deleteVideo } = await import("@/lib/hosting/bunny");
    await deleteVideo(e.bunnyGuid).catch(() => {});
  }
  await prisma.videoSource
    .deleteMany({ where: { episodeId: id, sourceSite: "nyaa" } })
    .catch(() => {});
  await prisma.episode.update({
    where: { id },
    data: {
      needsReview: false,
      publish: "DRAFT",
      bunnyGuid: null,
      bunnyStatus: null,
      bunnyError: null,
      hostedAt: null,
    },
  });
  revalidatePath("/console/review");
  if (e) await bust(e.seriesId);
}

export async function resolveReport(id: string, action: "RESOLVED" | "DISMISSED") {
  await requireAdmin();
  await prisma.report.update({
    where: { id },
    data: { status: action, resolvedAt: new Date() },
  });
  revalidatePath("/console/reports");
}

export async function deleteSource(id: string) {
  await requireAdmin();
  const src = await prisma.videoSource.delete({
    where: { id },
    select: { episodeId: true },
  });
  revalidatePath("/console");
  await bust(await seriesIdForEpisode(src.episodeId));
}
