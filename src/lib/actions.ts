"use server";

import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type {
  AnimeSeason,
  PublishStatus,
  SourceMaterial,
  SourceStatus,
  Weekday,
} from "@prisma/client";

const slug = (s: string) => slugify(s, { lower: true, strict: true });
const csv = (v?: string) =>
  v ? [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))] : [];

/** Bust the public ISR cache for a series + its shared pages. */
async function bust(seriesId?: string) {
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/tags");
  if (seriesId) {
    const s = await prisma.series
      .findUnique({ where: { id: seriesId }, select: { slug: true } })
      .catch(() => null);
    if (s) {
      revalidatePath(`/hentai/${s.slug}`);
      revalidatePath(`/hentai/${s.slug}`, "layout");
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

async function resolveStudio(name?: string) {
  if (!name?.trim()) return null;
  const s = name.trim();
  return prisma.studio.upsert({
    where: { slug: slug(s) },
    update: {},
    create: { name: s, slug: slug(s) },
  });
}

async function resolveTags(list: string[]) {
  const tags = [];
  for (const name of list) {
    tags.push(
      await prisma.tag.upsert({
        where: { slug: slug(name) },
        update: {},
        create: { name, slug: slug(name) },
      }),
    );
  }
  return tags;
}

export async function createSeries(form: FormData) {
  await requireRole("ADMIN", "MODERATOR");
  const d = seriesSchema.parse(Object.fromEntries(form));
  const studio = await resolveStudio(d.studioName);
  const tags = await resolveTags(csv(d.tags));

  const base = slug(d.title);
  let s = base;
  for (let i = 2; await prisma.series.findUnique({ where: { slug: s } }); i++) s = `${base}-${i}`;

  const created = await prisma.series.create({
    data: {
      ...seriesData(d, studio?.id ?? null),
      slug: s,
      publish: d.publish ?? "DRAFT",
      metadataSource: "manual",
      tags: { connect: tags.map((t) => ({ id: t.id })) },
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/series");
  await bust(created.id);
  return created.id;
}

export async function updateSeries(id: string, form: FormData) {
  await requireRole("ADMIN", "MODERATOR");
  const d = seriesSchema.parse(Object.fromEntries(form));
  const studio = await resolveStudio(d.studioName);
  const tags = await resolveTags(csv(d.tags));

  await prisma.series.update({
    where: { id },
    data: {
      ...seriesData(d, studio?.id ?? null),
      publish: d.publish ?? undefined,
      tags: { set: tags.map((t) => ({ id: t.id })) },
      // a hand-edit takes the row out of the auto-sync's write path
      metadataSource: "manual",
    },
  });
  revalidatePath(`/admin/series/${id}`);
  revalidatePath("/admin/series");
  await bust(id);
}

/** Quick publish-state change from the series list / editor header. */
export async function setSeriesPublish(id: string, publish: PublishStatus) {
  await requireRole("ADMIN", "MODERATOR");
  await prisma.series.update({ where: { id }, data: { publish } });
  revalidatePath("/admin/series");
  revalidatePath(`/admin/series/${id}`);
  await bust(id);
}

export async function deleteSeries(id: string) {
  await requireRole("ADMIN");
  const s = await prisma.series
    .findUnique({ where: { id }, select: { slug: true } })
    .catch(() => null);
  await prisma.series.delete({ where: { id } });
  revalidatePath("/admin/series");
  if (s) revalidatePath(`/hentai/${s.slug}`);
  await bust();
}

export async function deleteEpisode(id: string) {
  await requireRole("ADMIN", "MODERATOR");
  const e = await prisma.episode.delete({
    where: { id },
    select: { seriesId: true },
  });
  revalidatePath(`/admin/series/${e.seriesId}`);
  await bust(e.seriesId);
}

/** Review-queue decision on a `possible-minor`-flagged series. */
export async function reviewFlag(id: string, decision: "clear" | "reject") {
  await requireRole("ADMIN", "MODERATOR");
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
  revalidatePath("/admin/review");
  revalidatePath(`/admin/series/${id}`);
  await bust(id);
}

// ─────────── episodes ───────────

export async function createEpisode(seriesId: string, form: FormData) {
  await requireRole("ADMIN", "MODERATOR");
  const number = Number(form.get("number"));
  if (!Number.isFinite(number)) throw new Error("Bad episode number");

  const part = Number(form.get("part")) || 1;
  await prisma.episode.upsert({
    where: { seriesId_number_part: { seriesId, number, part } },
    update: {
      title: String(form.get("title") || "") || null,
      runtimeSec: Number(form.get("runtimeSec")) || undefined,
    },
    create: {
      seriesId,
      number,
      part,
      title: String(form.get("title") || "") || null,
      runtimeSec: Number(form.get("runtimeSec")) || 0,
      publish: "PUBLISHED",
    },
  });
  await prisma.series.update({ where: { id: seriesId }, data: { updatedAt: new Date() } });
  revalidatePath(`/admin/series/${seriesId}`);
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
  embedUrl: z.string().url(),
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
  await requireRole("ADMIN", "MODERATOR");
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
  revalidatePath("/admin");
  await bust(await seriesIdForEpisode(episodeId));
}

export async function setSourceStatus(id: string, status: SourceStatus) {
  await requireRole("ADMIN", "MODERATOR");
  const src = await prisma.videoSource.update({
    where: { id },
    data: { status, lastCheckedAt: new Date() },
    select: { episodeId: true },
  });
  revalidatePath("/admin");
  await bust(await seriesIdForEpisode(src.episodeId));
}

export async function setPublish(
  kind: "series" | "episode",
  id: string,
  publish: PublishStatus,
) {
  await requireRole("ADMIN", "MODERATOR");
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
  revalidatePath("/admin");
  await bust(seriesId);
}

/** Torrent-grabbed episode passed spot-check → clear the hold and publish it. */
export async function approveTorrentEpisode(id: string) {
  await requireRole("ADMIN", "MODERATOR");
  const e = await prisma.episode.update({
    where: { id },
    data: { needsReview: false },
    select: { seriesId: true },
  });
  const { publishIfLive } = await import("@/lib/verify");
  await publishIfLive(id).catch(() => {});
  revalidatePath("/admin/review");
  await bust(e.seriesId);
}

/** Torrent grab was wrong (bad episode / language / quality) → bin the Bunny
 *  copy and leave the episode without a source. */
export async function rejectTorrentEpisode(id: string) {
  await requireRole("ADMIN", "MODERATOR");
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
  revalidatePath("/admin/review");
  if (e) await bust(e.seriesId);
}

export async function resolveReport(id: string, action: "RESOLVED" | "DISMISSED") {
  const me = await requireRole("ADMIN", "MODERATOR");
  await prisma.report.update({
    where: { id },
    data: { status: action, reviewedById: me.id, resolvedAt: new Date() },
  });
  revalidatePath("/admin/reports");
}

export async function deleteSource(id: string) {
  await requireRole("ADMIN", "MODERATOR");
  const src = await prisma.videoSource.delete({
    where: { id },
    select: { episodeId: true },
  });
  revalidatePath("/admin");
  await bust(await seriesIdForEpisode(src.episodeId));
}
