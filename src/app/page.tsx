import Link from "next/link";
import { homeSections } from "@/lib/queries";
import { AdSlot } from "@/components/AdSlot";
import { ContinueWatching } from "@/components/ContinueWatching";
import { HomeHero } from "@/components/HomeHero";
import { ScrollRow } from "@/components/ScrollRow";
import { GenreGrid } from "@/components/GenreGrid";
import { SeriesCard } from "@/components/SeriesCard";
import { EpisodeCard } from "@/components/EpisodeCard";

export const revalidate = 120;

export default async function HomePage() {
  const h = await homeSections();

  const hasAnything =
    h.hero.length + h.trending.length + h.recentEpisodes.length + h.newSeries.length >
    0;

  if (!hasAnything) {
    return (
      <main className="mx-auto max-w-content px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold">
          Lust<span className="text-accent">Hentai</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          No published content yet — check back soon.
        </p>
      </main>
    );
  }

  return (
    <>
      {h.hero.length > 0 && (
        <HomeHero
          heroYear={h.heroYear}
          items={h.hero.map((s) => ({
            slug: s.slug,
            title: s.title,
            synopsis: s.synopsis,
            coverUrl: s.coverUrl,
            bannerUrl: s.bannerUrl,
            type: s.type,
            year: s.year,
            status: s.status,
            isCensored: s.isCensored,
            externalScore: s.externalScore,
            episodeCount: s._count.episodes,
            firstEpisode: s.episodes[0]?.number ?? 1,
            tags: s.tags.map((t) => ({ slug: t.slug, name: t.name })),
          }))}
        />
      )}

      <main className="mx-auto max-w-content pb-8 lg:px-8">
        <ContinueWatching />
        <AdSlot slotKey="home-top" className="mt-6 px-4 lg:px-0" />

        {h.recentEpisodes.length > 0 && (
          <ScrollRow title="Latest episodes" href="/browse/new">
            {h.recentEpisodes.map((ep) => (
              <EpisodeCard key={ep.id} ep={ep} />
            ))}
          </ScrollRow>
        )}

        {h.newSeries.length > 0 && (
          <ScrollRow title="New series" href="/browse/new">
            {h.newSeries.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

        {h.trending.length > 0 && (
          <ScrollRow title="Trending now" href="/browse?sort=popular">
            {h.trending.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

        {h.uncensored.length > 0 && (
          <ScrollRow title="Uncensored" href="/browse/uncensored">
            {h.uncensored.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

        <AdSlot slotKey="home-mid" className="my-12 px-4 lg:px-0" />

        <GenreGrid genres={h.genres} />

        {h.tagRows.map((row) => (
          <ScrollRow key={row.slug} title={row.name} href={`/tag/${row.slug}`}>
            {row.series.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        ))}

        {h.ongoing.length > 0 && (
          <ScrollRow title="Ongoing" href="/browse?status=ongoing">
            {h.ongoing.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

        {h.topRated.length > 0 && (
          <ScrollRow title="Top rated" href="/browse?sort=rating">
            {h.topRated.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

        <section className="mt-14 grid gap-3 px-4 sm:grid-cols-2 lg:px-0">
          <Link
            href="/browse"
            className="flex items-center justify-between rounded-2xl border border-line bg-surface/50 p-6 transition hover:border-accent/30"
          >
            <div>
              <p className="font-display text-base font-bold">Browse the full catalogue</p>
              <p className="mt-1 text-sm text-white/45">
                Filter by genre, studio, type, status and year.
              </p>
            </div>
            <span className="text-2xl text-accent">→</span>
          </Link>
          <Link
            href="/calendar"
            className="flex items-center justify-between rounded-2xl border border-line bg-surface/50 p-6 transition hover:border-accent/30"
          >
            <div>
              <p className="font-display text-base font-bold">Release calendar</p>
              <p className="mt-1 text-sm text-white/45">
                See what dropped and what&apos;s coming, day by day.
              </p>
            </div>
            <span className="text-2xl text-accent">→</span>
          </Link>
        </section>

        <AdSlot slotKey="home-footer" className="mt-12 px-4 lg:px-0" />
      </main>
    </>
  );
}
