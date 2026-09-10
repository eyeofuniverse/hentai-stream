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

function Box({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface/30 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-white/50">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-[11px] font-medium text-white/40 transition-colors hover:text-accent"
          >
            All →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Right column on browse / tag / studio: top rated, genres, years. Desktop only.
 *  Pass `bare` when an ancestor already provides the column width / visibility. */
export function CatalogSidebar({ data, bare }: { data: Sidebar; bare?: boolean }) {
  const cls = bare ? "space-y-4" : "hidden w-72 shrink-0 space-y-4 lg:block";

  return (
    <aside className={cls}>
      {data.topRated.length > 0 && (
        <Box title="Top rated" href="/browse?sort=rating">
          <ol className="space-y-1">
            {data.topRated.map((s, i) => {
              const score = s.ratingCount > 0 ? s.ratingAvg : s.externalScore;
              return (
                <li key={s.slug}>
                  <Link
                    href={`/hentai/${s.slug}`}
                    className="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                  >
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
                        {score ? (
                          <RatingBadge
                            score={score}
                            size="sm"
                            source={s.ratingCount > 0 ? null : "mal"}
                          />
                        ) : null}
                        {s.year && (
                          <span className="text-[10px] text-white/35">{s.year}</span>
                        )}
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
          <ul className="-mx-2 grid grid-cols-2 gap-x-2">
            {data.tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/tag/${t.slug}`}
                  className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="truncate">{t.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-white/25">
                    {t.seriesCount.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {data.years.length > 0 && (
        <Box title="By year">
          <div className="grid grid-cols-4 gap-1.5">
            {data.years.map((y) => (
              <Link
                key={y}
                href={`/browse?year=${y}`}
                className="rounded-md bg-white/[0.04] py-1.5 text-center text-xs font-medium tabular-nums text-white/60 transition-colors hover:bg-accent hover:text-white"
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
