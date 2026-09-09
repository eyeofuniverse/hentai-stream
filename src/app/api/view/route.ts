import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { episodeId } = await req.json().catch(() => ({}));
  if (typeof episodeId !== "string") return NextResponse.json({ ok: false });

  // truncate to a UTC day for the per-day rollup that feeds weeklyViews /
  // trendingScore (see scripts/recompute.mts)
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  await prisma
    .$transaction([
      prisma.episode.update({
        where: { id: episodeId },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.series.updateMany({
        where: { episodes: { some: { id: episodeId } } },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.episodeDailyStat.upsert({
        where: { episodeId_date: { episodeId, date: day } },
        create: { episodeId, date: day, views: 1, uniques: 1 },
        update: { views: { increment: 1 } },
      }),
    ])
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
