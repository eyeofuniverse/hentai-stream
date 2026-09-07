import Link from "next/link";
import { gradientFor } from "@/lib/gradient";

export function GenreGrid({
  genres,
}: {
  genres: { slug: string; name: string; _count: { series: number } }[];
}) {
  if (genres.length === 0) return null;
  return (
    <section className="mt-9 px-4 sm:px-0">
      <h2 className="mb-3 text-lg font-bold tracking-tight sm:text-xl">
        <span className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded bg-accent" />
        Browse by genre
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {genres.map((g) => (
          <Link
            key={g.slug}
            href={`/tag/${g.slug}`}
            className="group relative flex h-20 items-end overflow-hidden rounded-xl p-3"
            style={{ backgroundImage: gradientFor(g.slug) }}
          >
            <div className="absolute inset-0 bg-black/25 transition group-hover:bg-black/10" />
            <div className="relative">
              <p className="font-bold leading-tight drop-shadow">{g.name}</p>
              <p className="text-[11px] text-white/80">{g._count.series} titles</p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/tags"
        className="mt-3 inline-block text-xs text-white/40 hover:text-white"
      >
        All genres & tags →
      </Link>
    </section>
  );
}
