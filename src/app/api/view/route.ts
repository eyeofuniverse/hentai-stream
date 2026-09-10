import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { episodeId } = await req.json().catch(() => ({}));
  if (typeof episodeId !== "string" || episodeId.length > 64)
    return NextResponse.json({ ok: false });

  const ip = clientIp(req);
  // one counted view per IP per episode per 30 min, and an overall ceiling per
  // IP so a single client can't inflate trendingScore / weeklyViews
  if (
    !rateLimit(`view:${ip}:${episodeId}`, 1, 30 * 60_000) ||
    !rateLimit(`view:${ip}`, 60, 60 * 60_000)
  ) {
    return NextResponse.json({ ok: true, throttled: true });
  }

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
