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
    headers: ad
      ? { "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600" }
      : { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
