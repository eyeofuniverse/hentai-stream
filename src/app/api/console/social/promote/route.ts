import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { buildSeriesPromoData, buildEpisodePromoData, runPromote, type Platform } from "@/lib/social/post";

export const dynamic = "force-dynamic";

const ALL_PLATFORMS: Platform[] = ["bluesky"];

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    seriesId,
    episodeId,
    platforms,
    blueskyCaption,
    tags: clientTags,
    coverImageUrl: overrideCoverImageUrl,
  } = body as {
    seriesId?: string;
    episodeId?: string;
    platforms?: string[];
    blueskyCaption?: string;
    tags?: string[];
    coverImageUrl?: string | null;
  };

  if (!seriesId) return NextResponse.json({ error: "seriesId required" }, { status: 400 });

  const activePlatforms =
    Array.isArray(platforms) && platforms.length > 0
      ? (platforms.filter((p): p is Platform => ALL_PLATFORMS.includes(p as Platform)) as Platform[])
      : ALL_PLATFORMS;

  const data = episodeId ? await buildEpisodePromoData(episodeId) : await buildSeriesPromoData(seriesId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tags = [...new Set([...(clientTags ?? []), ...data.tags])];
  const coverImageUrl = overrideCoverImageUrl !== undefined ? overrideCoverImageUrl : data.coverImageUrl;

  const result = await runPromote({
    platforms: activePlatforms,
    title: data.title,
    blueskyCaption: blueskyCaption?.trim() || data.caption,
    url: data.url,
    tags,
    coverImageUrl,
  });

  const anyOk = Object.values(result).some((r) => r?.ok);
  if (anyOk) {
    if (episodeId) {
      await prisma.episode.update({ where: { id: episodeId }, data: { socialPostedAt: new Date() } }).catch(() => {});
    } else {
      await prisma.series.update({ where: { id: seriesId }, data: { socialPostedAt: new Date() } }).catch(() => {});
    }
  }

  return NextResponse.json(result);
}
