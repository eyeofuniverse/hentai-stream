import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/queries";
import { cover, thumb } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";
import { hlsUrl, thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ReportBroken } from "@/components/ReportBroken";
import { ViewPing } from "@/components/ViewPing";

// ISR — most requests serve cached HTML; admin edits call revalidatePath.
export const revalidate = 600;
export const dynamicParams = true;

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

  const t = `${ep.series.title} Episode ${ep.number}${
    ep.series.isCensored ? "" : " Uncensored"
  }`;
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
    thumbnailUrl: [hosted?.poster, thumb(ep.thumbUrl), cover(ep.series.coverUrl)].filter(
      Boolean,
    ),
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
    partOfSeries: {
      "@type": "TVSeries",
      name: ep.series.title,
      url: `${SITE}/hentai/${slug}`,
    },
  };

  const NavBtn = ({
    to,
    children,
  }: {
    to: number | null;
    children: React.ReactNode;
  }) =>
    to ? (
      <Link
        href={`/hentai/${slug}/${to}`}
        className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-white/75 transition hover:border-accent/40 hover:text-white"
      >
        {children}
      </Link>
    ) : (
      <span className="rounded-lg border border-line/50 px-3.5 py-2 text-sm text-white/20">
        {children}
      </span>
    );

  return (
    <main className="bg-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* theater */}
      <div className="border-b border-line bg-black/40">
        <div className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-4 lg:px-8">
          <ViewPing episodeId={ep.id} />
          <WatchPlayer sources={ep.sources} hosted={hosted} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* main column */}
          <div className="min-w-0">
            <nav className="text-xs text-white/40">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="mx-1.5">/</span>
              <Link href={`/hentai/${slug}`} className="hover:text-white">
                {ep.series.title}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-white/60">Episode {ep.number}</span>
            </nav>

            <h1 className="mt-2 font-display text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
              {ep.series.title} — Episode {ep.number}
              {ep.title ? `: ${ep.title}` : ""}
            </h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <NavBtn to={prev?.number ?? null}>← Prev</NavBtn>
                <NavBtn to={next?.number ?? null}>Next →</NavBtn>
              </div>
              <ReportBroken episodeId={ep.id} />
            </div>

            {ep.synopsis && (
              <p className="mt-5 text-sm leading-relaxed text-white/70">{ep.synopsis}</p>
            )}

            {ep.series.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {ep.series.tags.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/tag/${t.slug}`}
                    className="rounded-full bg-surface px-3 py-1 text-xs text-white/65 transition hover:bg-surface-2 hover:text-white"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}

            {next && (
              <Link
                href={`/hentai/${slug}/${next.number}`}
                className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3 transition hover:border-accent/40"
              >
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {thumb(ep.series.coverUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(ep.series.coverUrl)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ backgroundImage: gradientFor(slug) }} />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                    Up next
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white/85">
                    Episode {next.number}
                    {next.title ? `: ${next.title}` : ""}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* episode list sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-line bg-surface/50">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-display text-sm font-bold">All episodes</span>
                <span className="text-xs text-white/35">{eps.length}</span>
              </div>
              <div className="no-scrollbar max-h-[70vh] overflow-y-auto p-2">
                {eps.map((e) => {
                  const cur = e.number === ep.number;
                  return (
                    <Link
                      key={e.number}
                      href={`/hentai/${slug}/${e.number}`}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        cur
                          ? "bg-accent/15 text-white"
                          : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-9 shrink-0 place-items-center rounded text-xs font-bold ${
                          cur ? "bg-accent text-white" : "bg-surface-2 text-white/60"
                        }`}
                      >
                        {e.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {e.title || `Episode ${e.number}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link
              href={`/hentai/${slug}`}
              className="mt-3 block rounded-xl border border-line bg-surface/50 px-4 py-3 text-center text-sm font-medium text-white/70 transition hover:border-accent/30 hover:text-white"
            >
              View series page
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
