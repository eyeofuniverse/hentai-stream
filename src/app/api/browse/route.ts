import { NextResponse } from "next/server";
import { browseSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const data = await browseSeries({
    tag: sp.get("tag") ?? undefined,
    studio: sp.get("studio") ?? undefined,
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    year: sp.get("year") ?? undefined,
    censored: sp.get("censored") ?? undefined,
    sort: (sp.get("sort") as never) ?? undefined,
    page: Number(sp.get("page")) || 1,
  });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
  });
}
