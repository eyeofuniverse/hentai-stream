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
      <Poster src={cover(series.coverUrl)} title={series.title} seed={series.slug}>
        <PlayGlyph />
        {series.type && (
          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {series.type}
          </span>
        )}
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
