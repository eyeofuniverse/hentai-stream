import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { verifyStream, bunnyEmbed } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// hosts we are willing to redirect to
const ALLOW =
  /(?:^|\.)(?:mediadelivery\.net|b-cdn\.net|hgasm\d?\.(?:com|net|org)|hstorage\.xyz|miohentai\.com)$/i;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const e = u.searchParams.get("e") ?? "";
  const s = u.searchParams.get("s") ?? "";
  const t = u.searchParams.get("t") ?? "";

  if (!e || !s || !t || !verifyStream(e, s, t)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let realUrl: string | null = null;

  if (s === "bunny") {
    const ep = await db(() =>
      prisma.episode.findFirst({
        where: { id: e, publish: "PUBLISHED", bunnyStatus: "ready" },
        select: { bunnyGuid: true },
      }),
    ).catch(() => null);
    if (ep?.bunnyGuid) realUrl = bunnyEmbed(ep.bunnyGuid);
  } else {
    const src = await db(() =>
      prisma.videoSource.findFirst({
        where: {
          id: s,
          episodeId: e,
          status: "ACTIVE",
          episode: { publish: "PUBLISHED", series: { publish: "PUBLISHED" } },
        },
        select: { embedUrl: true },
      }),
    ).catch(() => null);
    realUrl = src?.embedUrl ?? null;
  }

  if (!realUrl) return new NextResponse("Not found", { status: 404 });

  let target: URL;
  try {
    target = new URL(realUrl);
  } catch {
    return new NextResponse("Bad source", { status: 502 });
  }
  if (target.protocol !== "https:" || !ALLOW.test(target.hostname)) {
    return new NextResponse("Blocked", { status: 502 });
  }

  return NextResponse.redirect(target.toString(), {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
