import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { verifyStream } from "@/lib/stream";
import { hlsUrl } from "@/lib/hosting/bunny";
import { rateLimit, clientIp } from "@/lib/ratelimit";

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

  // One play is one request (hls.js reuses the signed playlist), so this is far
  // above real use but stops a script minting signed Bunny URLs across the catalog.
  // Generous on purpose: a mobile carrier's CGNAT puts many real viewers behind one IP.
  if (!rateLimit(`stream:${clientIp(req)}`, 120, 60_000)) {
    return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  let realUrl: string | null = null;

  if (s === "bunny") {
    const ep = await db(() =>
      prisma.episode.findFirst({
        where: { id: e, publish: "PUBLISHED", bunnyStatus: "ready" },
        select: { bunnyGuid: true },
      }),
    ).catch(() => null);
    if (ep?.bunnyGuid) realUrl = hlsUrl(ep.bunnyGuid);
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
      // Bunny's pull zone enforces a Referer whitelist (403s anything else,
      // confirmed directly) — "no-referrer" would strip it on the redirected
      // request and break every hosted episode. Third-party mirrors don't
      // referer-check and we'd rather not leak our domain to them anyway.
      "Referrer-Policy": s === "bunny" ? "strict-origin-when-cross-origin" : "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
