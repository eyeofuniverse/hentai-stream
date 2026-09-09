import Link from "next/link";
import type { Metadata } from "next";
import { searchSeries } from "@/lib/queries";
import { SeriesCard } from "@/components/SeriesCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false } };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchSeries(q);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-xl font-extrabold tracking-tight">
        {q ? (
          <>
            Results for “{q}”{" "}
            <span className="text-white/35">({results.length})</span>
          </>
        ) : (
          "Search"
        )}
      </h1>

      {q && results.length === 0 && (
        <div className="mt-16 text-center">
          <p className="text-sm text-white/45">
            Nothing found for “{q}”.
          </p>
          <p className="mt-1 text-xs text-white/30">
            Try a different spelling or an alternate title.
          </p>
          <Link
            href="/browse"
            className="mt-5 inline-block rounded-xl border border-line bg-surface px-6 py-2.5 text-sm hover:border-accent/40"
          >
            Browse the catalogue
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {results.map((s) => (
            <SeriesCard key={s.slug} series={s} />
          ))}
        </div>
      )}
    </main>
  );
}
