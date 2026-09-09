import { NextResponse } from "next/server";
import { searchSuggest } from "@/lib/search";
import { cover } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) {
    return NextResponse.json({ series: [], tags: [] });
  }

  const { series, tags } = await searchSuggest(q);

  return NextResponse.json(
    {
      series: series.map((s) => ({
        slug: s.slug,
        title: s.title,
        cover: cover(s.coverUrl),
        year: s.year,
        type: s.type,
        episodes: s.episodes,
      })),
      tags: tags.map((t) => ({ slug: t.slug, name: t.name, count: t.seriesCount })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    },
  );
}
