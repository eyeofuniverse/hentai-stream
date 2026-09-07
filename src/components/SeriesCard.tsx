import Link from "next/link";
import { cover } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";

type S = {
  slug: string;
  title: string;
  coverUrl: string | null;
  year?: number | null;
  type?: string | null;
  status?: string | null;
  _count?: { episodes: number };
};

export function SeriesCard({
  series,
  inRow,
}: {
  series: S;
  inRow?: boolean;
}) {
  const src = cover(series.coverUrl);
  return (
    <Link
      href={`/hentai/${series.slug}`}
      className={`group block ${
        inRow ? "w-[130px] shrink-0 snap-start sm:w-[150px]" : ""
      }`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-end p-2.5"
            style={{ backgroundImage: gradientFor(series.slug) }}
          >
            <span className="line-clamp-3 text-sm font-bold leading-tight text-white/95 drop-shadow">
              {series.title}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

        {series.type && (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
            {series.type}
          </span>
        )}
        {series._count && series._count.episodes > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold">
            {series._count.episodes} EP
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-tight text-white/90 transition group-hover:text-accent">
        {series.title}
      </p>
      {(series.year || series.status) && (
        <p className="mt-0.5 text-[11px] text-white/40">
          {[series.year, cap(series.status)].filter(Boolean).join(" · ")}
        </p>
      )}
    </Link>
  );
}

function cap(s?: string | null) {
  return s ? s[0] + s.slice(1).toLowerCase() : "";
}
