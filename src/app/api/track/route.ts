import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const BOT_PATTERN = /bot|crawl|spider|slurp|archiv|wget|curl|python|httpclient|facebookexternalhit|headless/i;

function parseDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/tablet|ipad|playbook|silk|(android(?!.*mobi))/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|windows\s*phone|blackberry|android/i.test(ua)) return "mobile";
  return "desktop";
}

function cleanReferrer(ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).origin; // strip path/query/fragment — keep protocol+host only
  } catch {
    return null;
  }
}

/** Public page-view beacon, called once per navigation by <PageTracker>.
 *  Never blocks or errors visibly to the client — a dropped beacon just means
 *  one missing row, not a broken page. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  // 120 page views per IP per minute — well above any real browsing cadence
  if (!rateLimit(`track:${ip}`, 120, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  try {
    let path = "/";
    let bodyReferrer: string | null = null;
    try {
      const body = await req.json();
      if (typeof body.path === "string") path = body.path.slice(0, 512);
      // PageTracker sends document.referrer only on the first page load of a
      // session; soft navigations send null so we don't clobber attribution
      // with an internal URL.
      if (typeof body.referrer === "string" && body.referrer) {
        bodyReferrer = body.referrer.slice(0, 512);
      }
    } catch {
      return NextResponse.json({ ok: true });
    }

    if (path.startsWith("/console") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_PATTERN.test(ua)) return NextResponse.json({ ok: true });

    // The body's referrer is document.referrer (the real external landing
    // page). The HTTP Referer header would just be the previous same-site
    // page on client-side navigation, which would misclassify everything as
    // internal.
    const referrer = cleanReferrer(bodyReferrer);
    const deviceType = parseDeviceType(ua);

    await prisma.pageVisit.create({
      data: { ip, path, userAgent: ua.slice(0, 512), referrer, deviceType },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
