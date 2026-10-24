import { NextResponse } from "next/server";
import { getActiveAdForSlot } from "@/lib/ad-queries";

const VALID = new Set(["mobile", "tablet", "desktop", "all"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slot = searchParams.get("slot") ?? "";
  const raw = searchParams.get("device") ?? "all";
  // tablet falls back to desktop-sized units
  const device = VALID.has(raw) ? (raw === "tablet" ? "desktop" : raw) : "all";

  if (!slot) {
    return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  }

  const ad = await getActiveAdForSlot(slot, device);
  return NextResponse.json(ad, {
    // a slot's pool now holds several same-priority creatives that should
    // rotate across visits — the old 600s/3600s shared-cache window meant
    // every visitor hitting the same edge POP got the exact same random
    // pick for up to an hour, defeating the rotation almost entirely.
    // Tightened to 150s for better rotation (2026-10-18), then eased back
    // out to 300s (2026-10-24) once Function Invocations became the binding
    // constraint, not ad variety — several slots fire this route per
    // pageview, so this is the single biggest invocation multiplier on the
    // site. Still rotates ~12x/hour across all visitors combined.
    headers: ad
      ? { "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=900" }
      : { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
