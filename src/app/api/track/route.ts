import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp, isSameOrigin } from "@/lib/ratelimit";
import { isSuspectBrowserUA } from "@/lib/bot-ua";

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
  if (!isSameOrigin(req)) return NextResponse.json({ ok: true });

  const ip = clientIp(req);
  // 120 page views per IP per minute — well above any real browsing cadence
  if (!rateLimit(`track:${ip}`, 120, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  try {
    let path = "/";
    let bodyReferrer: string | null = null;
    // <PageTracker> now reports a page AFTER leaving it (on the next
    // navigation, or on visibilitychange/pagehide for the last page of a
    // session), once it actually knows how long the visitor was on it —
    // enteredAt is that page's own arrival timestamp, so visitedAt reflects
    // when the view started rather than when the beacon happened to fire.
    let enteredAt: number | null = null;
    let durationSec: number | null = null;
    // Client-generated id, stable for one logical page visit across
    // background/foreground cycles — lets a resumed tab extend the existing
    // row instead of inserting a new one every time it's backgrounded.
    let visitId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body.path === "string") path = body.path.slice(0, 512);
      // PageTracker sends document.referrer only on the first page load of a
      // session; soft navigations send null so we don't clobber attribution
      // with an internal URL.
      if (typeof body.referrer === "string" && body.referrer) {
        bodyReferrer = body.referrer.slice(0, 512);
      }
      if (typeof body.enteredAt === "number" && Number.isFinite(body.enteredAt)) {
        enteredAt = body.enteredAt;
      }
      if (typeof body.duration === "number" && Number.isFinite(body.duration)) {
        // clamp — a suspended/backgrounded tab can report an enormous gap
        durationSec = Math.max(0, Math.min(body.duration, 6 * 60 * 60));
      }
      if (typeof body.visitId === "string" && body.visitId.length > 0) {
        visitId = body.visitId.slice(0, 64);
      }
    } catch {
      return NextResponse.json({ ok: true });
    }

    if (path.startsWith("/console") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_PATTERN.test(ua) || isSuspectBrowserUA(ua)) return NextResponse.json({ ok: true });

    // The body's referrer is document.referrer (the real external landing
    // page). The HTTP Referer header would just be the previous same-site
    // page on client-side navigation, which would misclassify everything as
    // internal.
    const referrer = cleanReferrer(bodyReferrer);
    const deviceType = parseDeviceType(ua);
    const visitedAt = enteredAt ? new Date(enteredAt) : undefined;

    const data = {
      ip,
      path,
      userAgent: ua.slice(0, 512),
      referrer,
      deviceType,
      durationSec,
      ...(visitedAt && !isNaN(visitedAt.getTime()) ? { visitedAt } : {}),
    };

    if (visitId) {
      // Repeat beacons for the same visit (tab backgrounded, then resumed)
      // only ever extend this one row's duration — everything else about the
      // visit (ip/path/referrer/visitedAt) was fixed by whichever call
      // created it.
      await prisma.pageVisit.upsert({
        where: { id: visitId },
        create: { id: visitId, ...data },
        update: { durationSec },
      });
    } else {
      await prisma.pageVisit.create({ data });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
