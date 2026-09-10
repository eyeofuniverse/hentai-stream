import Link from "next/link";
import { cover } from "@/lib/cloudinary";
import { SmartImg } from "@/components/SmartImg";
import { RatingBadge } from "@/components/RatingBadge";

type Sidebar = {
  tags: { slug: string; name: string; seriesCount: number }[];
  years: number[];
  topRated: {
    slug: string;
    title: string;
    coverUrl: string | null;
    year: number | null;
    externalScore: number | null;
    ratingAvg: number;
    ratingCount: number;
  }[];
};

function Box({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-[11px] font-medium text-white/40 hover:text-accent">
            All →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** watchhentai-style right column: genres, years, top rated. Desktop only. */
export function CatalogSidebar({ data }: { data: Sidebar }) {
  return (
    <aside className="hidden w-72 shrink-0 space-y-4 lg:block">
      {data.topRated.length > 0 && (
        <Box title="Top rated" href="/browse?sort=rating">
          <ol className="space-y-2">
            {data.topRated.map((s, i) => {
              const score = s.ratingCount > 0 ? s.ratingAvg : s.externalScore;
              return (
                <li key={s.slug}>
                  <Link href={`/hentai/${s.slug}`} className="group flex items-center gap-2.5">
                    <span className="w-4 shrink-0 text-center font-display text-sm font-extrabold text-white/25">
                      {i + 1}
                    </span>
                    <span className="block h-12 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
                      <SmartImg
                        src={cover(s.coverUrl)}
                        seed={s.slug}
                        alt=""
                        width={80}
                        height={120}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white/85 group-hover:text-accent">
                        {s.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {score ? <RatingBadge score={score} size="sm" source={s.ratingCount > 0 ? null : "mal"} /> : null}
                        {s.year && <span className="text-[10px] text-white/35">{s.year}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Box>
      )}

      {data.tags.length > 0 && (
        <Box title="Genres" href="/tags">
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/12 hover:text-white"
              >
                {t.name} <span className="text-white/30">{t.seriesCount}</span>
              </Link>
            ))}
          </div>
        </Box>
      )}

      {data.years.length > 0 && (
        <Box title="By year">
          <div className="flex flex-wrap gap-1.5">
            {data.years.map((y) => (
              <Link
                key={y}
                href={`/browse?year=${y}`}
                className="rounded-lg bg-white/6 px-2 py-1 text-xs font-medium text-white/70 transition hover:bg-white/12 hover:text-white"
              >
                {y}
              </Link>
            ))}
          </div>
        </Box>
      )}
    </aside>
  );
}
