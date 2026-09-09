import Link from "next/link";
import { thumb, cover } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";

export function EpisodeCard({
  ep,
}: {
  ep: {
    number: number;
    title?: string | null;
    thumbUrl?: string | null;
    runtimeSec?: number | null;
    series: { slug: string; title: string; coverUrl: string | null };
  };
}) {
  const src = thumb(ep.thumbUrl) ?? thumb(ep.series.coverUrl) ?? cover(ep.series.coverUrl);
  const mins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;

  return (
    <Link
      href={`/hentai/${ep.series.slug}/${ep.number}`}
      className="group block w-[230px] shrink-0 snap-start sm:w-[260px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={ep.series.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: gradientFor(ep.series.slug) }} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/90 text-white shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>

        <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
          EP {ep.number}
        </span>
        {mins && (
          <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
            {mins}m
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-white/90 transition group-hover:text-accent">
        {ep.series.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-white/40">
        {ep.title || `Episode ${ep.number}`}
      </p>
    </Link>
  );
}
