import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getEpisode, relatedSeries, miniLists } from "@/lib/queries";
import { findRedirect } from "@/lib/redirect-map";
import { cover, thumb, thumbSet } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";
import { SmartImg } from "@/components/SmartImg";
import { SeriesCard } from "@/components/SeriesCard";
import { buildServers } from "@/lib/stream";
import { SITE, SITE_NAME, abs, episodeSeo, breadcrumbLd } from "@/lib/seo";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ReportBroken } from "@/components/ReportBroken";
import { ViewPing } from "@/components/ViewPing";
import { ProgressTracker } from "@/components/watch/ProgressTracker";
import { RatingBadge } from "@/components/RatingBadge";
import { Pill } from "@/components/ui";
import { AdSlot } from "@/components/AdSlot";
import { EpisodeList } from "@/components/watch/EpisodeList";
import { ShareButton } from "@/components/watch/ShareButton";
import { RailSeriesList } from "@/components/watch/RailSeriesList";
import { WatchInternalLinks } from "@/components/watch/WatchInternalLinks";
import { Faq } from "@/components/seo/Faq";
import { episodeFaq } from "@/lib/faq";
import { Comments } from "@/components/comments/Comments";

// ISR — most requests serve cached HTML; admin edits call revalidatePath.
export const revalidate = 600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [] as { slug: string; episode: string }[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}): Promise<Metadata> {
  const { slug, episode } = await params;
  const ep = await getEpisode(slug, Number(episode));
  if (!ep) return { title: "Not found", robots: { index: false } };

  const { title, description } = episodeSeo(ep);
  const canonical = `/hentai/${slug}/${ep.number}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "video.episode",
      siteName: SITE_NAME,
      // image comes from opengraph-image.tsx in this route segment — the
      // episode's real Bunny thumbnail when hosted, always a proper 1200x630
    },
    twitter: { card: "summary_large_image", title, description },
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
  if (!ep) {
    const to = await findRedirect(`/hentai/${slug}/${episode}`);
    if (to) permanentRedirect(to);
    notFound();
  }

  const s = ep.series;
  const eps = s.episodes;
  const idx = eps.findIndex((e) => e.number === ep.number);
  const prev = idx > 0 ? eps[idx - 1] : null;
  const next = idx >= 0 && idx < eps.length - 1 ? eps[idx + 1] : null;

  const bunnyReady = ep.bunnyStatus === "ready" && !!ep.bunnyGuid;
  const servers = buildServers(ep.id, bunnyReady, ep.sources);
  const poster = bunnyReady ? bunnyThumb(ep.bunnyGuid!) : thumb(ep.thumbUrl) ?? null;

  const [related, mini] = await Promise.all([
    relatedSeries(s.id, s.tags.map((t) => t.slug), 12),
    miniLists(),
  ]);

  const { title: seoTitle, description, genres } = episodeSeo(ep);
  const canonical = `${SITE}/hentai/${slug}/${ep.number}`;
  const embedUrl = `${SITE}/embed/${slug}/${ep.number}`;
  const thumbs = (() => {
    const list = [
      ...new Set(
        [thumb(s.coverUrl), cover(s.coverUrl)]
          .filter((x): x is string => !!x)
          .map((x) => abs(x)),
      ),
    ];
    return list.length ? list : [abs("/opengraph-image")];
  })();
  const rating = s.ratingCount > 0 ? s.ratingAvg : s.externalScore;
  const runtimeMins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;

  const videoLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${s.title} Episode ${ep.number}${ep.title ? `: ${ep.title}` : ""}`,
    description,
    thumbnailUrl: thumbs,
    uploadDate: (ep.airedAt ?? ep.createdAt).toISOString(),
    ...(ep.runtimeSec ? { duration: `PT${ep.runtimeSec}S` } : {}),
    embedUrl,
    url: canonical,
    genre: genres || undefined,
    keywords: s.tags.map((t) => t.name).join(", ") || undefined,
    inLanguage: "en",
    isFamilyFriendly: false,
    contentRating: "adult",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE}/android-chrome-512x512.png` },
    },
    ...(ep.viewCount
      ? {
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/WatchAction",
            userInteractionCount: ep.viewCount,
          },
        }
      : {}),
    potentialAction: { "@type": "WatchAction", target: canonical },
    partOfSeries: {
      "@type": "TVSeries",
      name: s.title,
      url: `${SITE}/hentai/${slug}`,
    },
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
    { name: s.title, path: `/hentai/${slug}` },
    { name: `Episode ${ep.number}`, path: `/hentai/${slug}/${ep.number}` },
  ]);

  const genreList = s.tags.slice(0, 5).map((t) => t.name).join(", ");
  const bodyText =
    ep.synopsis ||
    s.synopsis ||
    `Watch ${s.title} episode ${ep.number} online${
      s.isCensored ? "" : ", uncensored"
    }. ${s.title} is ${/^[aeiou]/i.test(s.type) ? "an" : "a"} ${s.type.toLowerCase()} hentai${
      s.year ? ` from ${s.year}` : ""
    }${s.studio ? ` by ${s.studio.name}` : ""}${
      genreList ? `, tagged ${genreList}` : ""
    }. Stream every episode free in HD on ${SITE_NAME} — no account, on desktop and mobile.`;


  const prevHref = prev ? `/hentai/${slug}/${prev.number}` : null;
  const nextHref = next ? `/hentai/${slug}/${next.number}` : null;

  const NavBtn = ({
    href,
    dir,
    e,
  }: {
    href: string | null;
    dir: "prev" | "next";
    e: (typeof eps)[number] | null;
  }) =>
    href && e ? (
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-white/75 transition hover:border-accent/40 hover:text-white"
      >
        {dir === "prev" && <span aria-hidden>←</span>}
        {dir === "prev" ? "Prev" : "Next"} · Ep {e.number}
        {dir === "next" && <span aria-hidden>→</span>}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/50 px-3 py-2 text-xs text-white/50">
        {dir === "prev" ? "← Prev" : "Next →"}
      </span>
    );

  const UpNext = () =>
    next ? (
      <Link
        href={`/hentai/${slug}/${next.number}`}
        className="group flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3 transition hover:border-accent/40 hover:bg-surface"
      >
        <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <SmartImg
            src={
              next.bunnyStatus === "ready" && next.bunnyGuid
                ? bunnyThumb(next.bunnyGuid)
                : thumb(s.coverUrl)
            }
            fallback={thumb(s.coverUrl)}
            seed={`${slug}-${next.number}`}
            srcSet={thumbSet(s.coverUrl) ?? undefined}
            sizes="128px"
            width={360}
            height={203}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover:opacity-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white drop-shadow">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Up next
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-white/85">
            Episode {next.number}
            {next.title ? `: ${next.title}` : ""}
          </p>
        </div>
      </Link>
    ) : (
      <Link
        href={`/hentai/${slug}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-4 text-sm transition hover:border-accent/40"
      >
        <span>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-good">
            Series complete
          </span>
          <span className="mt-0.5 block font-semibold text-white/85">
            You&apos;ve reached the last episode
          </span>
        </span>
        <span className="shrink-0 text-white/50">↗</span>
      </Link>
    );

  return (
    <main className="bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <div className="mx-auto max-w-content px-2.5 py-3 sm:px-4 lg:px-8 lg:py-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_356px]">
          {/* ─────────── main column ─────────── */}
          <div className="min-w-0">
            <ViewPing episodeId={ep.id} seriesSlug={slug} episodeNumber={ep.number} />
            <ProgressTracker episodeId={ep.id} />

            <WatchPlayer
              servers={servers}
              poster={poster}
              title={s.title}
              nextHref={nextHref}
              prevHref={prevHref}
            />

            <AdSlot slotKey="watch-under-player" className="mt-4" />

            {/* title + facts */}
            <div className="mt-4 px-1 sm:mt-5 sm:px-0">
              <nav className="text-xs text-white/50" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-white">Home</Link>
                <span className="mx-1.5">/</span>
                <Link href={`/hentai/${slug}`} className="hover:text-white">
                  {s.title}
                </Link>
                <span className="mx-1.5">/</span>
                <span className="text-white/60">Episode {ep.number}</span>
              </nav>

              <h1 className="mt-2 font-display text-xl font-extrabold leading-tight tracking-tight sm:text-[26px]">
                {s.title} — Episode {ep.number}
                {ep.title ? `: ${ep.title}` : ""}
                {!s.isCensored ? " (Uncensored)" : ""}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {rating ? (
                  <RatingBadge
                    score={rating}
                    votes={s.ratingCount || null}
                    source={s.ratingCount > 0 ? null : "mal"}
                    size="sm"
                  />
                ) : null}
                <Pill tone="accent">{s.type}</Pill>
                {s.year && <Pill>{s.year}</Pill>}
                <Pill tone={s.isCensored ? "default" : "good"}>
                  {s.isCensored ? "Censored" : "Uncensored"}
                </Pill>
                <Link href={`/hentai/${slug}`}>
                  <Pill className="hover:bg-white/15">
                    {eps.length} episode{eps.length === 1 ? "" : "s"}
                  </Pill>
                </Link>
                {runtimeMins && <Pill>{runtimeMins} min</Pill>}
                {s.studio && (
                  <Link href={`/studio/${s.studio.slug}`}>
                    <Pill className="hover:bg-white/15">{s.studio.name}</Pill>
                  </Link>
                )}
              </div>

              {/* action bar */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <NavBtn href={prevHref} dir="prev" e={prev} />
                <NavBtn href={nextHref} dir="next" e={next} />
                <ShareButton title={`${s.title} — Episode ${ep.number}`} />
                <span className="ml-auto">
                  <ReportBroken episodeId={ep.id} />
                </span>
              </div>
            </div>

            {/* mobile-only: up next + episodes + a banner slot */}
            <div className="mt-5 space-y-4 lg:hidden">
              <UpNext />
              <EpisodeList
                slug={slug}
                episodes={eps}
                current={ep.number}
                maxHeight="340px"
              />
              <AdSlot slotKey="watch-below-episodes" />
            </div>

            {/* description / SEO copy */}
            <section className="mt-6 rounded-2xl border border-line bg-surface/30 p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-white/72">{bodyText}</p>
              <p className="mt-2.5 text-xs text-white/50">
                {seoTitle}
                {s.studio ? ` · Studio ${s.studio.name}` : ""} ·{" "}
                {servers.length} streaming server{servers.length === 1 ? "" : "s"}
              </p>

              {s.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
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
            </section>

            <div className="mt-8">
              <Faq
                items={episodeFaq(ep)}
                title={`${s.title} Episode ${ep.number} — FAQ`}
              />
            </div>

            <Comments
              targetType="episode"
              targetId={ep.id}
              title={`Episode ${ep.number} comments`}
            />

            <AdSlot slotKey="watch-in-content" className="my-10" />

            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
                  <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
                  You might also like
                </h2>
                <div className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
                  {related.map((r) => (
                    <SeriesCard key={r.slug} series={r} />
                  ))}
                </div>
              </section>
            )}

            <WatchInternalLinks
              seriesTitle={s.title}
              seriesSlug={slug}
              studio={s.studio}
              year={s.year}
              type={s.type}
              isCensored={s.isCensored}
              tags={s.tags}
            />

            <AdSlot slotKey="watch-footer" className="mt-10" />
          </div>

          {/* ─────────── right rail (lg+) ─────────── */}
          <aside className="mt-10 hidden min-w-0 self-start lg:mt-0 lg:block">
            <div className="space-y-4 [contain:layout]">
              <UpNext />

              <AdSlot slotKey="watch-rail-top" label={false} />

              <EpisodeList
                slug={slug}
                episodes={eps}
                current={ep.number}
                maxHeight="70vh"
              />

              <Link
                href={`/hentai/${slug}`}
                className="block rounded-2xl border border-line bg-surface/50 px-4 py-3 text-center text-sm font-medium text-white/70 transition hover:border-accent/30 hover:text-white"
              >
                View series page
              </Link>

              <AdSlot slotKey="watch-rail-sticky" label={false} />

              <RailSeriesList
                title="Trending now"
                href="/browse?sort=trending"
                items={mini.popular}
              />

              <RailSeriesList
                title={`New on ${SITE_NAME}`}
                href="/browse?sort=new"
                items={mini.fresh}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
