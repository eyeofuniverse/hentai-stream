import Link from "next/link";
import { cover } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";

export function EpisodeCard({
  ep,
}: {
  ep: {
    number: number;
    series: { slug: string; title: string; coverUrl: string | null };
  };
}) {
  const src = cover(ep.series.coverUrl);
  return (
    <Link
      href={`/hentai/${ep.series.slug}/${ep.number}`}
      className="group block w-[130px] shrink-0 snap-start sm:w-[150px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={ep.series.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-end p-2.5"
            style={{ backgroundImage: gradientFor(ep.series.slug) }}
          >
            <span className="line-clamp-3 text-sm font-bold leading-tight drop-shadow">
              {ep.series.title}
            </span>
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6 text-xs font-bold">
          Episode {ep.number}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-white/85 transition group-hover:text-accent">
        {ep.series.title}
      </p>
    </Link>
  );
}
