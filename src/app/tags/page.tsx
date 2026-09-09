import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "All hentai tags & genres",
  description: "Every genre, theme and tag on LustHentai.",
};

function getTags() {
  return db(() =>
    prisma.tag.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { series: true } } },
    }),
  );
}

const CATS: { key: string; label: string }[] = [
  { key: "GENRE", label: "Genres" },
  { key: "THEME", label: "Themes" },
  { key: "FETISH", label: "Fetishes & kinks" },
  { key: "FORMAT", label: "Format" },
  { key: "CW", label: "Content warnings" },
];

export default async function TagsPage() {
  const tags = await getTags().catch(
    () => [] as Awaited<ReturnType<typeof getTags>>,
  );

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Genres &amp; tags
      </h1>
      <p className="mt-1 text-sm text-white/45">
        {tags.length.toLocaleString()} tags across the catalogue.
      </p>

      {CATS.map((cat) => {
        const group = tags
          .filter((t) => (t.category ?? "THEME") === cat.key)
          .filter((t) => t._count.series > 0);
        if (group.length === 0) return null;
        return (
          <section key={cat.key} className="mt-10">
            <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
              {cat.label}
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
                    {t._count.series}
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
