import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { searchResults, recordSearch, popularSearches } from "@/lib/search";
import { browseSeries } from "@/lib/queries";
import { SearchBar } from "@/components/SearchBar";
import { SeriesCard } from "@/components/SeriesCard";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  if (!term) return { title: "Search", robots: { index: false } };

  const { series } = await searchResults(term);
  const title = `${term} hentai${series.length ? "" : " — not found"}`;
  const description = series.length
    ? `${series.length} hentai series matching “${term}” — stream subbed & uncensored on LustHentai.`
    : `No results for “${term}” yet. Browse the full hentai catalogue on LustHentai.`;

  return {
    title,
    description,
    alternates: { canonical: `/search?q=${encodeURIComponent(term)}` },
    // index only genuinely useful result pages; keep thin/empty ones out
    robots: { index: series.length >= 3, follow: true },
    openGraph: { title, description, url: `/search?q=${encodeURIComponent(term)}` },
  };
}

function isBot(ua: string) {
  return /bot|crawl|spider|slurp|bing|google|facebookexternalhit|embedly/i.test(ua);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim();

  const [{ series, tags }, ua] = await Promise.all([
    term.length >= 2 ? searchResults(term) : Promise.resolve({ series: [], tags: [] }),
    headers().then((h) => h.get("user-agent") ?? ""),
  ]);

  if (term.length >= 2 && !isBot(ua)) {
    await recordSearch({
      raw: term,
      resultCount: series.length,
      topSeries: series[0] ? { id: series[0].id, title: series[0].title } : null,
    });
  }

  const popular = await popularSearches(14);
  const fallback =
    term.length >= 2 && series.length === 0
      ? (await browseSeries({ sort: "popular" })).items
      : [];

  const jsonLd =
    series.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Hentai search results for "${term}"`,
          numberOfItems: series.length,
          itemListElement: series.slice(0, 20).map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/hentai/${s.slug}`,
            name: s.title,
          })),
        }
      : null;

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <nav className="text-xs text-white/40">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Search{term ? `: ${term}` : ""}</span>
      </nav>

      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">
        {term ? (
          <>
            {series.length} result{series.length === 1 ? "" : "s"} for “{term}”
          </>
        ) : (
          "Search"
        )}
      </h1>

      <div className="mt-4 max-w-xl">
        <SearchBar initial={term} big />
      </div>

      {/* matching genres */}
      {tags.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
            Matching genres
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="group inline-flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-sm transition hover:border-accent/40 hover:bg-surface"
              >
                <span className="font-medium text-white/85 group-hover:text-white">
                  {t.name}
                </span>
                <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] font-semibold text-white/45">
                  {t.seriesCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* results */}
      {series.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 flex items-center gap-2.5 font-display text-base font-bold">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
            Series
          </h2>
          <div className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {series.map((s) => (
              <SeriesCard
                key={s.slug}
                series={{
                  slug: s.slug,
                  title: s.title,
                  coverUrl: s.coverUrl,
                  year: s.year,
                  type: s.type,
                  status: s.status,
                  _count: { episodes: s.episodes },
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* no results */}
      {term.length >= 2 && series.length === 0 && (
        <section className="mt-8">
          <div className="rounded-2xl border border-line bg-surface/40 p-6 text-center sm:p-10">
            <p className="font-display text-lg font-bold">
              We don&apos;t have “{term}” yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
              Nothing in the catalogue matches that. Try an alternate title or
              romanised spelling — or browse by genre below. We log every miss and
              add the most-requested titles first.
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-block rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Browse the catalogue
            </Link>
          </div>

          {fallback.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-4 flex items-center gap-2.5 font-display text-base font-bold">
                <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
                Popular right now
              </h2>
              <div className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {fallback.slice(0, 12).map((s) => (
                  <SeriesCard key={s.slug} series={s} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* empty state (no query) */}
      {!term && (
        <p className="mt-8 text-sm text-white/45">
          Search the full catalogue by title, or jump to a genre.
        </p>
      )}

      {/* related searches — internal linking + content */}
      {popular.length > 0 && (
        <section className="mt-14 border-t border-line pt-8">
          <h2 className="mb-3 font-display text-sm font-bold text-white/60">
            Popular searches
          </h2>
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <Link
                key={p.term}
                href={`/search?q=${encodeURIComponent(p.sample)}`}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  p.term === term.toLowerCase()
                    ? "bg-accent/20 text-accent"
                    : "bg-surface text-white/60 hover:bg-surface-2 hover:text-white"
                }`}
              >
                {p.sample}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
