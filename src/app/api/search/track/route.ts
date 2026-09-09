import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { recordSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Called (via sendBeacon) when a searcher clicks a suggestion — the strongest
 *  signal of what they wanted. `slug` = series picked, `tagSlug` = genre picked. */
export async function POST(req: Request) {
  let body: { q?: unknown; slug?: unknown; tagSlug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const q = typeof body.q === "string" ? body.q : "";
  const slug = typeof body.slug === "string" ? body.slug : "";
  const tagSlug = typeof body.tagSlug === "string" ? body.tagSlug : "";
  if (q.trim().length < 2) return NextResponse.json({ ok: false });

  let topSeries: { id: string; title: string } | null = null;
  if (slug) {
    topSeries = await db(() =>
      prisma.series.findUnique({ where: { slug }, select: { id: true, title: true } }),
    ).catch(() => null);
  }

  // a picked suggestion (series or genre) means the search succeeded
  const resultCount = topSeries || tagSlug ? 1 : 0;
  await recordSearch({ raw: q, resultCount, topSeries });
  return NextResponse.json({ ok: true });
}
