import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";
import { gradientFor } from "@/lib/gradient";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Hentai Genres & Tags — Browse by Category",
  description:
    "Every hentai genre, theme and kink on LustHentai — vanilla, NTR, incest, big breasts, ahegao, tentacles and more. Pick a tag to browse.",
  alternates: { canonical: "/tags" },
  openGraph: { title: "Hentai Genres & Tags", url: "/tags" },
};

function getTags() {
  return db(() =>
    prisma.tag.findMany({
      where: { seriesCount: { gt: 0 } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        category: true,
        seriesCount: true,
        featured: true,
      },
    }),
  );
}

const CATS: { key: string; label: string }[] = [
  { key: "GENRE", label: "Genres" },
  { key: "THEME", label: "Themes & settings" },
  { key: "FETISH", label: "Kinks & body" },
  { key: "FORMAT", label: "Format" },
  { key: "CONTENT_WARNING", label: "Content warnings" },
];

export default async function TagsPage() {
  const tags = await getTags().catch(
    () => [] as Awaited<ReturnType<typeof getTags>>,
  );

  const featured = tags
    .filter((t) => t.featured)
    .sort((a, b) => b.seriesCount - a.seriesCount);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Genres &amp; tags
      </h1>
      <p className="mt-1 text-sm text-white/45">
        {tags.length.toLocaleString()} tags with content across the catalogue.
      </p>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
            Popular genres
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((g) => (
              <Link
                key={g.slug}
                href={`/tag/${g.slug}`}
                className="group relative flex h-20 items-end overflow-hidden rounded-xl p-3 ring-1 ring-white/5"
              >
                <div
                  className="absolute inset-0 transition duration-500 group-hover:scale-105"
                  style={{ backgroundImage: gradientFor(g.slug) }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/5" />
                <div className="relative">
                  <p className="font-display text-sm font-bold text-white drop-shadow">
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
      )}

      {CATS.map((cat) => {
        const group = tags.filter((t) => (t.category ?? "THEME") === cat.key);
        if (group.length === 0) return null;
        return (
          <section key={cat.key} className="mt-10">
            <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
              {cat.label}
              <span className="text-xs font-normal text-white/50">{group.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {group.map((t) => (
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
        );
      })}
    </main>
  );
}
