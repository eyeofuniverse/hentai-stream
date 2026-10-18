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
    // s-maxage=60 fixed the rotation but, with several ad slots firing this
    // route per pageview across real traffic, a 10x-shorter cache meant
    // ~10x more real function executions — a real, measurable contributor
    // to a Vercel usage spike (2026-10-18). 150s is the compromise: still
    // rotates several times an hour, far fewer cold executions than 60s.
    headers: ad
      ? { "Cache-Control": "public, max-age=60, s-maxage=150, stale-while-revalidate=450" }
      : { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
