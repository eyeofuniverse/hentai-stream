import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { mapStatus, getVideo } from "@/lib/hosting/bunny";
import { publishIfLive } from "@/lib/verify";

export const dynamic = "force-dynamic";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";

/**
 * Bunny Stream status webhook. Fires on every transcode state change with
 * { VideoLibraryId, VideoGuid, Status }. On "finished" we mark the episode
 * ready and publish it; on error we mark it failed.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || String(body.VideoLibraryId) !== LIBRARY_ID) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const guid: string = body.VideoGuid;
  const status = mapStatus(Number(body.Status));

  const ep = await db(() =>
    prisma.episode.findFirst({
      where: { bunnyGuid: guid },
      select: { id: true, seriesId: true },
    }),
  ).catch(() => null);
  if (!ep) return NextResponse.json({ ok: true, note: "no episode for guid" });

  let runtimeSec: number | undefined;
  if (status === "ready") {
    const v = await getVideo(guid).catch(() => null);
    if (v?.length) runtimeSec = Math.round(v.length);
  }

  await db(() =>
    prisma.episode.update({
      where: { id: ep.id },
      data: {
        bunnyStatus: status,
        ...(status === "ready" ? { hostedAt: new Date() } : {}),
        ...(status === "failed" ? { bunnyError: `bunny status ${body.Status}` } : {}),
        ...(runtimeSec ? { runtimeSec } : {}),
      },
    }),
  );

  if (status === "ready") {
    await publishIfLive(ep.id).catch(() => {});
    // bust the episode page cache
    const s = await prisma.series
      .findUnique({ where: { id: ep.seriesId }, select: { slug: true } })
      .catch(() => null);
    if (s) {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/hentai/${s.slug}`);
      revalidatePath(`/hentai/${s.slug}`, "layout");
    }
  }

  return NextResponse.json({ ok: true, status });
}
