import Link from "next/link";
import { cover } from "@/lib/cloudinary";
import { Poster, PlayGlyph } from "@/components/ui";

type S = {
  slug: string;
  title: string;
  coverUrl: string | null;
  year?: number | null;
  type?: string | null;
  status?: string | null;
  isCensored?: boolean | null;
  externalScore?: number | null;
  _count?: { episodes: number };
};

export function SeriesCard({
  series,
  inRow,
}: {
  series: S;
  inRow?: boolean;
}) {
  const eps = series._count?.episodes ?? 0;
  return (
    <Link
      href={`/hentai/${series.slug}`}
      className={`group block ${
        inRow ? "w-[136px] shrink-0 snap-start sm:w-[160px]" : ""
      }`}
    >
      <Poster
        src={cover(series.coverUrl)}
        coverId={series.coverUrl}
        title={series.title}
        seed={series.slug}
      >
        <PlayGlyph />
        {series.type && (
          <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {series.type}
          </span>
        )}
        {series.externalScore ? (
          <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-warn">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3 6.9 7.6.7-5.7 5 1.7 7.4L12 18l-6.6 4 1.7-7.4-5.7-5 7.6-.7z" />
            </svg>
            {series.externalScore.toFixed(1)}
          </span>
        ) : series.isCensored === false ? (
          <span className="absolute right-2 top-2 rounded-md bg-good/85 px-1.5 py-0.5 text-[10px] font-bold text-black">
            UNC
          </span>
        ) : null}
        {eps > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
            {eps} EP
          </span>
        )}
      </Poster>

      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 transition group-hover:text-accent">
        {series.title}
      </p>
      {(series.year || series.status) && (
        <p className="mt-0.5 text-[11px] text-white/50">
          {[series.year, cap(series.status)].filter(Boolean).join(" · ")}
        </p>
      )}
    </Link>
  );
}

function cap(s?: string | null) {
  return s ? s[0] + s.slice(1).toLowerCase() : "";
}
