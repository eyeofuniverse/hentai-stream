import { NextResponse } from "next/server";
import { viewer } from "@/lib/user";
import { continueWatching } from "@/lib/user-queries";
import { thumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await viewer();
  if (!me) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const rows = await continueWatching(me.id, 12);
  const items = rows.map((r) => {
    const e = r.episode;
    return {
      slug: e.series.slug,
      seriesTitle: e.series.title,
      number: e.number,
      title: e.title,
      thumb:
        e.bunnyStatus === "ready" && e.bunnyGuid
          ? bunnyThumb(e.bunnyGuid)
          : thumb(e.thumbUrl) ?? thumb(e.series.coverUrl),
    };
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
