import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getVisitorData } from "@/lib/visitor-analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = parseInt(new URL(req.url).searchParams.get("days") ?? "7", 10);
  const days = Number.isNaN(raw) ? 7 : Math.min(90, Math.max(1, raw));
  const data = await getVisitorData(days);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
