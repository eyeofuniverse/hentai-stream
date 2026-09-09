import Link from "next/link";
import { gradientFor } from "@/lib/gradient";
import { SectionHeader } from "@/components/ui";

export function GenreGrid({
  genres,
}: {
  genres: { slug: string; name: string; seriesCount: number }[];
}) {
  if (genres.length === 0) return null;
  return (
    <section className="mt-12 px-4 lg:px-0">
      <SectionHeader title="Browse by genre" href="/tags" linkLabel="All genres & tags" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map((g) => (
          <Link
            key={g.slug}
            href={`/tag/${g.slug}`}
            className="group relative flex h-24 items-end overflow-hidden rounded-xl p-3.5 ring-1 ring-white/5"
          >
            <div
              className="absolute inset-0 transition duration-500 group-hover:scale-105"
              style={{ backgroundImage: gradientFor(g.slug) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/5 transition group-hover:from-black/45" />
            <div className="relative">
              <p className="font-display font-bold leading-tight text-white drop-shadow">
                {g.name}
              </p>
              <p className="text-[11px] font-medium text-white/75">
                {g.seriesCount} titles
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
