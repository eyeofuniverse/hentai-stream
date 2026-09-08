import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/queries";
import { cover, thumb } from "@/lib/cloudinary";
import { hlsUrl, thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ReportBroken } from "@/components/ReportBroken";
import { ViewPing } from "@/components/ViewPing";

// ISR — most requests serve cached HTML; admin edits call revalidatePath.
export const revalidate = 600;
export const dynamicParams = true;

// Empty list keeps builds fast; unknown (slug, episode) pairs render on first
// hit and are then cached with ISR semantics.
export function generateStaticParams() {
  return [] as { slug: string; episode: string }[];
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}): Promise<Metadata> {
  const { slug, episode } = await params;
  const ep = await getEpisode(slug, Number(episode));
  if (!ep) return { title: "Not found" };

  const t = `${ep.series.title} Episode ${ep.number}${ep.series.isCensored ? "" : " Uncensored"}`;
  const desc =
    ep.synopsis?.slice(0, 155) ??
    `Watch ${ep.series.title} episode ${ep.number} hentai online, subbed. ${ep.sources.length} mirror(s).`;

  return {
    title: t,
    description: desc,
    alternates: { canonical: `/hentai/${slug}/${ep.number}` },
    openGraph: {
      title: t,
      description: desc,
      url: `/hentai/${slug}/${ep.number}`,
      type: "video.episode",
      images: cover(ep.series.coverUrl) ? [cover(ep.series.coverUrl)!] : [],
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const num = Number(episode);
  const ep = await getEpisode(slug, num);
  if (!ep) notFound();

  const eps = ep.series.episodes;
  const idx = eps.findIndex((e) => e.number === ep.number);
  const prev = idx > 0 ? eps[idx - 1] : null;
  const next = idx < eps.length - 1 ? eps[idx + 1] : null;

  const hosted =
    ep.bunnyGuid && ep.bunnyStatus === "ready"
      ? {
          guid: ep.bunnyGuid,
          hls: hlsUrl(ep.bunnyGuid),
          poster: thumb(ep.thumbUrl) ?? bunnyThumb(ep.bunnyGuid),
        }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${ep.series.title} Episode ${ep.number}`,
    description: ep.synopsis ?? ep.series.synopsis ?? undefined,
    thumbnailUrl: [
      hosted?.poster,
      thumb(ep.thumbUrl),
      cover(ep.series.coverUrl),
    ].filter(Boolean),
    uploadDate: (ep.airedAt ?? ep.createdAt).toISOString(),
    duration: ep.runtimeSec ? `PT${ep.runtimeSec}S` : undefined,
    contentUrl: hosted?.hls,
    embedUrl: `${SITE}/hentai/${slug}/${ep.number}`,
    genre: ep.series.tags.map((t) => t.name),
    isFamilyFriendly: false,
    interactionStatistic: ep.viewCount
      ? {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/WatchAction",
          userInteractionCount: ep.viewCount,
        }
      : undefined,
    url: `${SITE}/hentai/${slug}/${ep.number}`,
    partOfSeries: { "@type": "TVSeries", name: ep.series.title, url: `${SITE}/hentai/${slug}` },
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-3 text-xs text-white/40">
        <Link href="/">Home</Link> /{" "}
        <Link href={`/hentai/${slug}`}>{ep.series.title}</Link> / Episode {ep.number}
      </nav>

      <h1 className="mb-3 text-lg font-bold">
        {ep.series.title} — Episode {ep.number}
        {ep.title ? `: ${ep.title}` : ""}
      </h1>

      <ViewPing episodeId={ep.id} />
      <WatchPlayer sources={ep.sources} hosted={hosted} />

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          {prev ? (
            <Link
              href={`/hentai/${slug}/${prev.number}`}
              className="rounded-lg bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              ← Ep {prev.number}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/hentai/${slug}/${next.number}`}
              className="rounded-lg bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Ep {next.number} →
            </Link>
          )}
        </div>
        <ReportBroken episodeId={ep.id} />
      </div>

      {ep.synopsis && (
        <p className="mt-5 text-sm leading-relaxed text-white/75">{ep.synopsis}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {ep.series.tags.map((t) => (
          <Link
            key={t.slug}
            href={`/tag/${t.slug}`}
            className="rounded-full bg-surface px-2.5 py-1 text-xs text-white/70 hover:bg-surface-2"
          >
            {t.name}
          </Link>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-base font-bold">All episodes</h2>
      <div className="flex flex-wrap gap-1.5">
        {eps.map((e) => (
          <Link
            key={e.number}
            href={`/hentai/${slug}/${e.number}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              e.number === ep.number ? "bg-accent font-semibold" : "bg-surface hover:bg-surface-2"
            }`}
          >
            {e.number}
          </Link>
        ))}
      </div>
    </main>
  );
}
