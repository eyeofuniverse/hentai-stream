import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";
import { socialMeta } from "@/lib/seo";

export const revalidate = 21600;

const SM_TITLE = "Sitemap — LustHentai";
const SM_DESC = "Every section of LustHentai in one place — genres, studios, seasons, years and more.";

export const metadata: Metadata = {
  title: SM_TITLE,
  description: SM_DESC,
  alternates: { canonical: "/sitemap-index" },
  ...socialMeta({ title: SM_TITLE, description: SM_DESC, path: "/sitemap-index" }),
};

const SEASON_RANK: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };

async function getData() {
  return db(() =>
    Promise.all([
      prisma.tag.findMany({
        where: { seriesCount: { gt: 0 } },
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      }),
      prisma.studio.findMany({
        where: { seriesCount: { gt: 0 } },
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      }),
      prisma.series
        .findMany({
          where: { publish: "PUBLISHED", year: { not: null } },
          select: { year: true },
          distinct: ["year"],
        })
        .then((rows) => rows.map((r) => r.year as number).sort((a, b) => b - a)),
      prisma.series.groupBy({
        by: ["animeSeason", "seasonYear"],
        where: { publish: "PUBLISHED", animeSeason: { not: null }, seasonYear: { not: null } },
        _count: true,
      }),
    ]),
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-bold">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
        {title}
      </h2>
      {children}
    </section>
  );
}

const linkCls =
  "inline-block rounded-lg border border-line bg-surface/60 px-3 py-1.5 text-xs text-white/70 transition hover:border-accent/40 hover:text-white";

export default async function SitemapIndexPage() {
  const [tags, studios, years, seasonRows] = await getData().catch(
    () => [[], [], [], []] as Awaited<ReturnType<typeof getData>>,
  );

  const seasons = seasonRows
    .filter((r) => r.animeSeason && r.seasonYear && r._count > 0)
    .map((r) => ({
      slug: `${r.animeSeason!.toLowerCase()}-${r.seasonYear}`,
      label: `${r.animeSeason!.charAt(0)}${r.animeSeason!.slice(1).toLowerCase()} ${r.seasonYear}`,
      year: r.seasonYear!,
      season: r.animeSeason!,
    }))
    .sort((a, b) => b.year - a.year || SEASON_RANK[b.season] - SEASON_RANK[a.season]);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Sitemap</h1>
      <p className="mt-1 text-sm text-white/45">Every section of LustHentai, in one place.</p>

      <Section title="Browse">
        <div className="flex flex-wrap gap-2">
          {[
            ["/browse", "All titles"],
            ["/browse/new", "Latest additions"],
            ["/browse/trending", "Trending"],
            ["/browse/uncensored", "Uncensored"],
            ["/calendar", "Release calendar"],
            ["/az", "A-Z list"],
            ["/tags", "Genres & tags"],
            ["/season", "By season"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className={linkCls}>
              {label}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Genres & tags">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link key={t.slug} href={`/tag/${t.slug}`} className={linkCls}>
              {t.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Studios">
        <div className="flex flex-wrap gap-2">
          {studios.map((s) => (
            <Link key={s.slug} href={`/studio/${s.slug}`} className={linkCls}>
              {s.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Seasons">
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link key={s.slug} href={`/season/${s.slug}`} className={linkCls}>
              {s.label}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Years">
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link key={y} href={`/browse/year/${y}`} className={linkCls}>
              {y}
            </Link>
          ))}
        </div>
      </Section>
    </main>
  );
}
