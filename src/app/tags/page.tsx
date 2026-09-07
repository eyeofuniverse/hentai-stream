import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "All hentai tags & genres",
  description: "Every genre, theme and tag on HentaiStream.",
};

function getTags() {
  return db(() =>
    prisma.tag.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { series: true } } },
    }),
  );
}

export default async function TagsPage() {
  // Don't let a build-time DB blip fail the whole deploy — an empty render is
  // recovered on the first request after deploy (revalidate).
  const tags = await getTags().catch(
    () => [] as Awaited<ReturnType<typeof getTags>>,
  );

  const groups = {
    GENRE: tags.filter((t) => t.category === "GENRE"),
    THEME: tags.filter((t) => t.category === "THEME"),
    FETISH: tags.filter((t) => t.category === "FETISH"),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold">Tags</h1>
      {(["GENRE", "THEME", "FETISH"] as const).map((cat) => (
        <section key={cat} className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/35">
            {cat}
          </h2>
          <div className="flex flex-wrap gap-2">
            {groups[cat].map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="rounded-full bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                {t.name}
                <span className="ml-1.5 text-xs text-white/35">{t._count.series}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
