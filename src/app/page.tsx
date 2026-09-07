import Link from "next/link";
import { homeSections } from "@/lib/queries";
import { HomeHero } from "@/components/HomeHero";
import { ScrollRow } from "@/components/ScrollRow";
import { GenreGrid } from "@/components/GenreGrid";
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
      <main className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black">
          Hentai<span className="text-accent">Stream</span>
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

      <main className="mx-auto max-w-6xl pb-4 sm:px-4">
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
      </main>
    </>
  );
}
