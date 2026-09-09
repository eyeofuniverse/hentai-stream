import Link from "next/link";
import { homeSections } from "@/lib/queries";
import { HomeHero } from "@/components/HomeHero";
import { ScrollRow } from "@/components/ScrollRow";
import { GenreGrid } from "@/components/GenreGrid";
import { SectionHeader } from "@/components/ui";
import { SeriesCard } from "@/components/SeriesCard";
import { EpisodeCard } from "@/components/EpisodeCard";

export const revalidate = 120;

export default async function HomePage() {
  const h = await homeSections();

  const hasAnything =
    h.featured.length +
      h.trending.length +
      h.recentEpisodes.length +
      h.newSeries.length >
    0;

  if (!hasAnything) {
    return (
      <main className="mx-auto max-w-content px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold">
          Lust<span className="text-accent">Hentai</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          No published content yet. Add series and episodes in{" "}
          <Link href="/admin" className="text-accent underline">
            /admin
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <>
      {h.featured.length > 0 && (
        <HomeHero
          items={h.featured.map((s) => ({
            slug: s.slug,
            title: s.title,
            synopsis: s.synopsis,
            coverUrl: s.coverUrl,
            bannerUrl: s.bannerUrl,
            type: s.type,
            year: s.year,
            status: s.status,
            tags: s.tags.map((t) => ({ slug: t.slug, name: t.name })),
            episodes: s.episodes,
          }))}
        />
      )}

      <main className="mx-auto max-w-content pb-8 lg:px-8">
        {h.recentEpisodes.length > 0 && (
          <ScrollRow title="Recently added" href="/browse?sort=new">
            {h.recentEpisodes.map((ep) => (
              <EpisodeCard key={ep.id} ep={ep} />
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

        <GenreGrid genres={h.genres} />

        {h.newSeries.length > 0 && (
          <ScrollRow title="New series" href="/browse?sort=new">
            {h.newSeries.map((s) => (
              <SeriesCard key={s.slug} series={s} inRow />
            ))}
          </ScrollRow>
        )}

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

        <section className="mt-14 px-4 lg:px-0">
          <SectionHeader title="All titles" href="/browse" linkLabel="Open catalogue" />
          <Link
            href="/browse"
            className="flex items-center justify-between rounded-2xl border border-line bg-surface/50 p-6 transition hover:border-accent/30"
          >
            <div>
              <p className="font-display text-base font-bold">Browse the full catalogue</p>
              <p className="mt-1 text-sm text-white/45">
                Filter by genre, studio, type, status and more.
              </p>
            </div>
            <span className="text-2xl text-accent">→</span>
          </Link>
        </section>
      </main>
    </>
  );
}
