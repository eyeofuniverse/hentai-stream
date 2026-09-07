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
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-lg font-bold">
        {q ? (
          <>
            Results for “{q}” <span className="text-white/40">({results.length})</span>
          </>
        ) : (
          "Search"
        )}
      </h1>

      {q && results.length === 0 && (
        <p className="mt-8 text-sm text-white/40">
          Nothing found. Try a different spelling or an alternate title.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {results.map((s) => (
          <SeriesCard key={s.slug} series={s} />
        ))}
      </div>

      {results.length > 0 && (
        <p className="mt-6 text-xs text-white/30">
          <Link href="/browse" className="underline">
            Browse everything →
          </Link>
        </p>
      )}
    </main>
  );
}
