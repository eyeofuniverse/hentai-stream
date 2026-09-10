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
  const items = rows.map((r) => ({
    slug: r.slug,
    seriesTitle: r.seriesTitle,
    number: r.number,
    title: r.title,
    resume: r.resume,
    thumb:
      r.bunnyStatus === "ready" && r.bunnyGuid
        ? bunnyThumb(r.bunnyGuid)
        : thumb(r.thumbUrl) ?? thumb(r.coverUrl),
  }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
