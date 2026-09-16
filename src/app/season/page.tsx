import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";
import { gradientFor } from "@/lib/gradient";
import { socialMeta } from "@/lib/seo";

export const revalidate = 21600;

const SEASON_TITLE = "Hentai by Season — Anime Release Seasons";
const SEASON_DESC =
  "Browse hentai by the anime season it aired in — Winter, Spring, Summer and Fall, year by year, on LustHentai.";

export const metadata: Metadata = {
  title: SEASON_TITLE,
  description: SEASON_DESC,
  alternates: { canonical: "/season" },
  ...socialMeta({ title: SEASON_TITLE, description: SEASON_DESC, path: "/season" }),
};

const SEASON_RANK: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };

function getSeasons() {
  return db(() =>
    prisma.series.groupBy({
      by: ["animeSeason", "seasonYear"],
      where: { publish: "PUBLISHED", animeSeason: { not: null }, seasonYear: { not: null } },
      _count: true,
    }),
  );
}

export default async function SeasonIndexPage() {
  const rows = await getSeasons().catch(() => [] as Awaited<ReturnType<typeof getSeasons>>);

  const seasons = rows
    .filter((r) => r.animeSeason && r.seasonYear && r._count > 0)
    .map((r) => ({
      slug: `${r.animeSeason!.toLowerCase()}-${r.seasonYear}`,
      season: r.animeSeason!,
      year: r.seasonYear!,
      count: r._count,
    }))
    .sort((a, b) => b.year - a.year || SEASON_RANK[b.season] - SEASON_RANK[a.season]);

  const byYear = new Map<number, typeof seasons>();
  for (const s of seasons) {
    if (!byYear.has(s.year)) byYear.set(s.year, []);
    byYear.get(s.year)!.push(s);
  }

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Browse by season</h1>
      <p className="mt-1 text-sm text-white/45">
        {seasons.length.toLocaleString()} anime seasons with content across the catalogue.
      </p>

      {[...byYear.entries()].map(([year, group]) => (
        <section key={year} className="mt-10">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
            {year}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {group.map((s) => (
              <Link
                key={s.slug}
                href={`/season/${s.slug}`}
                className="group relative flex h-20 items-end overflow-hidden rounded-xl p-3 ring-1 ring-white/5"
              >
                <div
                  className="absolute inset-0 transition duration-500 group-hover:scale-105"
                  style={{ backgroundImage: gradientFor(s.slug) }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/5" />
                <div className="relative">
                  <p className="font-display text-sm font-bold capitalize text-white drop-shadow">
                    {s.season.toLowerCase()}
                  </p>
                  <p className="text-[11px] font-medium text-white/75">{s.count} titles</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
