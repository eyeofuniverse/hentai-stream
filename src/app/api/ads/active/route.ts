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
    // pick for up to an hour, defeating the rotation almost entirely. Short
    // enough here to actually rotate, still long enough to spare the DB a
    // query on every single ad-slot fetch.
    headers: ad
      ? { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=180" }
      : { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
