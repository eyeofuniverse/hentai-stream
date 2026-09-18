import { NextResponse } from "next/server";
import { viewer } from "@/lib/user";
import { continueWatching } from "@/lib/user-queries";
import { thumb, episodeThumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumbUrl } from "@/lib/hosting/bunny";

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
      episodeThumb(r.thumbUrl, r.bunnyStatus === "ready" && r.bunnyGuid ? bunnyThumbUrl(r.bunnyGuid) : null) ??
      thumb(r.coverUrl),
    // Episode-specific thumbnails have a known dead-link rate (a subset never
    // finished copying from Bunny into R2 — see scripts/repair-thumbs.mts).
    // The client falls back to this series cover on image load failure so a
    // dead one never shows as a blank card while the nightly repair catches up.
    fallback: thumb(r.coverUrl),
  }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
