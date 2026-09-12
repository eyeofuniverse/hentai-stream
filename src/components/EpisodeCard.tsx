import Link from "next/link";
import { thumb, thumbSet, THUMB_SIZES, episodeThumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumbUrl } from "@/lib/hosting/bunny";
import { SmartImg } from "@/components/SmartImg";

export function EpisodeCard({
  ep,
}: {
  ep: {
    number: number;
    title?: string | null;
    runtimeSec?: number | null;
    bunnyGuid?: string | null;
    bunnyStatus?: string | null;
    thumbUrl?: string | null;
    series: { slug: string; title: string; coverUrl: string | null };
  };
}) {
  // R2 copy of the episode's own thumbnail (scraped, or Bunny's own once
  // hosted — see episodeThumb), else the series cover, else SmartImg's
  // gradient placeholder.
  const seriesThumb = thumb(ep.series.coverUrl);
  const bunnyFallback = ep.bunnyStatus === "ready" && ep.bunnyGuid ? bunnyThumbUrl(ep.bunnyGuid) : null;
  const src = episodeThumb(ep.thumbUrl, bunnyFallback) ?? seriesThumb;
  // srcSet needs an actual R2 key to build width variants from — a raw
  // Bunny hotlink fallback has none, so only offer one when thumbUrl itself
  // is what's driving `src`.
  const srcSetSource = thumb(ep.thumbUrl) ? ep.thumbUrl : null;
  const mins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;

  return (
    <Link
      href={`/hentai/${ep.series.slug}/${ep.number}`}
      className="group block w-[230px] shrink-0 snap-start sm:w-[260px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5">
        <SmartImg
          src={src}
          fallback={seriesThumb}
          seed={`${ep.series.slug}-${ep.number}`}
          srcSet={srcSetSource ? (thumbSet(srcSetSource) ?? undefined) : undefined}
          sizes={THUMB_SIZES}
          width={360}
          height={203}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/90 text-white shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>

        <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-bg">
          EP {ep.number}
        </span>
        {mins && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
            {mins}m
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-white/90 transition group-hover:text-accent">
        {ep.series.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-white/50">
        {ep.title || `Episode ${ep.number}`}
      </p>
    </Link>
  );
}
