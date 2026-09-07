import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { episodeId } = await req.json().catch(() => ({}));
  if (typeof episodeId !== "string") return NextResponse.json({ ok: false });

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
    ])
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
