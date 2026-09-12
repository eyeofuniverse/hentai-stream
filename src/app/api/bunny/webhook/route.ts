import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { mapStatus, getVideo } from "@/lib/hosting/bunny";
import { copyBunnyThumbToR2 } from "@/lib/hosting/migrate";
import { publishIfLive } from "@/lib/verify";

export const dynamic = "force-dynamic";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";
// Optional: set this here AND as `?secret=<value>` on the webhook URL in the
// Bunny dashboard. LIBRARY_ID is public (it's in every embed URL), so without
// this the endpoint is callable by anyone who knows a video guid.
const WEBHOOK_SECRET = process.env.BUNNY_WEBHOOK_SECRET ?? "";

/**
 * Bunny Stream status webhook. Fires many times per video as it moves through
 * queue → processing → encoding → finished → resolution-finished, and the
 * payload's `Status` enum is NOT the same as the video API's `status` field —
 * so we ignore it and read the authoritative status straight from the API.
 * Never downgrades a video that's already ready.
 */
export async function POST(req: Request) {
  if (WEBHOOK_SECRET) {
    const provided = new URL(req.url).searchParams.get("secret");
    if (provided !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  if (!body || String(body.VideoLibraryId) !== LIBRARY_ID || !body.VideoGuid) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const guid: string = body.VideoGuid;

  const ep = await db(() =>
    prisma.episode.findFirst({
      where: { bunnyGuid: guid },
      select: { id: true, seriesId: true, bunnyStatus: true },
    }),
  ).catch(() => null);
  if (!ep) return NextResponse.json({ ok: true, note: "no episode for guid" });
  if (ep.bunnyStatus === "ready") return NextResponse.json({ ok: true, note: "already ready" });

  const v = await getVideo(guid).catch(() => null);
  if (!v) return NextResponse.json({ ok: true, note: "video not found" });
  const status = mapStatus(v.status);

  await db(() =>
    prisma.episode.update({
      where: { id: ep.id },
      data: {
        bunnyStatus: status,
        ...(status === "ready" ? { hostedAt: new Date() } : {}),
        ...(status === "failed" ? { bunnyError: `bunny status ${v.status}` } : {}),
        ...(v.length ? { runtimeSec: Math.round(v.length) } : {}),
      },
    }),
  );

  if (status === "ready") {
    await copyBunnyThumbToR2(ep.id);
    await publishIfLive(ep.id).catch(() => {});
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
