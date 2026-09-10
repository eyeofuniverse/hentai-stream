import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/queries";
import { cover, thumb, thumbSet } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";
import { SmartImg } from "@/components/SmartImg";
import { buildServers } from "@/lib/stream";
import { SITE, SITE_NAME, abs, episodeSeo, breadcrumbLd } from "@/lib/seo";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ReportBroken } from "@/components/ReportBroken";
import { ViewPing } from "@/components/ViewPing";
import { RatingBadge } from "@/components/RatingBadge";
import { Faq } from "@/components/seo/Faq";
import { episodeFaq } from "@/lib/faq";

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
  // OG / social images must be publicly fetchable — Cloudinary, not the
  // referer-locked Bunny CDN
  const img = thumb(ep.series.coverUrl) ?? cover(ep.series.coverUrl);
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
      images: img ? [{ url: img, width: 480, height: 270 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: img ? [img] : [],
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

  const bunnyReady = ep.bunnyStatus === "ready" && !!ep.bunnyGuid;
  const servers = buildServers(ep.id, bunnyReady, ep.sources);
  // the player poster must be landscape — a Bunny 16:9 still, or a scraped
  // episode still; never the portrait series cover (it letterboxes badly)
  const poster = bunnyReady ? bunnyThumb(ep.bunnyGuid!) : thumb(ep.thumbUrl) ?? null;

  const { title: seoTitle, description, genres } = episodeSeo(ep);
  const canonical = `${SITE}/hentai/${slug}/${ep.number}`;
  const embedUrl = `${SITE}/embed/${slug}/${ep.number}`;
  // VideoObject.thumbnailUrl is required and must be publicly fetchable — use
  // Cloudinary / MAL art (never the referer-locked Bunny CDN), and always fall
  // back to the OG card so the array is never empty
  const thumbs = (() => {
    const list = [
      ...new Set(
        [thumb(ep.series.coverUrl), cover(ep.series.coverUrl)]
          .filter((x): x is string => !!x)
          .map((x) => abs(x)),
      ),
    ];
    return list.length ? list : [abs("/opengraph-image")];
  })();
  const rating =
    ep.series.ratingCount > 0 ? ep.series.ratingAvg : ep.series.externalScore;

  const videoLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${ep.series.title} Episode ${ep.number}${ep.title ? `: ${ep.title}` : ""}`,
    description,
    thumbnailUrl: thumbs,
    uploadDate: (ep.airedAt ?? ep.createdAt).toISOString(),
    ...(ep.runtimeSec ? { duration: `PT${ep.runtimeSec}S` } : {}),
    embedUrl,
    url: canonical,
    genre: genres || undefined,
    keywords: ep.series.tags.map((t) => t.name).join(", ") || undefined,
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
      name: ep.series.title,
      url: `${SITE}/hentai/${slug}`,
    },
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
    { name: ep.series.title, path: `/hentai/${slug}` },
    { name: `Episode ${ep.number}`, path: `/hentai/${slug}/${ep.number}` },
  ]);

  const genreList = ep.series.tags.slice(0, 5).map((t) => t.name).join(", ");
  const bodyText =
    ep.synopsis ||
    ep.series.synopsis ||
    `Watch ${ep.series.title} episode ${ep.number} online${
      ep.series.isCensored ? "" : ", uncensored"
    }. ${ep.series.title} is ${
      /^[aeiou]/i.test(ep.series.type) ? "an" : "a"
    } ${ep.series.type.toLowerCase()} hentai${
      ep.series.year ? ` from ${ep.series.year}` : ""
    }${ep.series.studio ? ` by ${ep.series.studio.name}` : ""}${
      genreList ? `, tagged ${genreList}` : ""
    }. Stream every episode free in HD on ${SITE_NAME} — no account, on desktop and mobile.`;

  const NavBtn = ({ to, children }: { to: number | null; children: React.ReactNode }) =>
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      {/* theater */}
      <div className="border-b border-line bg-black/40">
        <div className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-4 lg:px-8">
          <ViewPing episodeId={ep.id} seriesSlug={slug} episodeNumber={ep.number} />
          <WatchPlayer
            servers={servers}
            poster={poster}
            nextHref={next ? `/hentai/${slug}/${next.number}` : null}
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <nav className="text-xs text-white/40" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="mx-1.5">/</span>
              <Link href={`/hentai/${slug}`} className="hover:text-white">
                {ep.series.title}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-white/60">Episode {ep.number}</span>
            </nav>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                {ep.series.title} — Episode {ep.number}
                {ep.title ? `: ${ep.title}` : ""}
                {!ep.series.isCensored ? " (Uncensored)" : ""}
              </h1>
              {rating ? (
                <RatingBadge
                  score={rating}
                  votes={ep.series.ratingCount || null}
                  source={ep.series.ratingCount > 0 ? null : "mal"}
                  size="sm"
                />
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <NavBtn to={prev?.number ?? null}>← Prev</NavBtn>
                <NavBtn to={next?.number ?? null}>Next →</NavBtn>
              </div>
              <ReportBroken episodeId={ep.id} />
            </div>

            {/* always-present descriptive copy for SEO + readers */}
            <p className="mt-5 text-sm leading-relaxed text-white/70">{bodyText}</p>
            <p className="mt-2 text-xs text-white/35">
              {seoTitle} · {ep.series.studio ? `Studio ${ep.series.studio.name} · ` : ""}
              {servers.length} streaming server{servers.length === 1 ? "" : "s"}
            </p>

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
                  <SmartImg
                    src={
                      next.bunnyStatus === "ready" && next.bunnyGuid
                        ? bunnyThumb(next.bunnyGuid)
                        : thumb(ep.series.coverUrl)
                    }
                    fallback={thumb(ep.series.coverUrl)}
                    seed={`${slug}-${next.number}`}
                    srcSet={thumbSet(ep.series.coverUrl) ?? undefined}
                    sizes="128px"
                    width={360}
                    height={203}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Up next</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/85">
                    Episode {next.number}
                    {next.title ? `: ${next.title}` : ""}
                  </p>
                </div>
              </Link>
            )}

            <Faq
              items={episodeFaq(ep)}
              title={`${ep.series.title} Episode ${ep.number} — FAQ`}
            />
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-line bg-surface/50">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-display text-sm font-bold">All episodes</span>
                <span className="text-xs text-white/35">{eps.length}</span>
              </div>
              <div className="no-scrollbar max-h-[70vh] overflow-y-auto p-2">
                {eps.map((e) => {
                  const isCur = e.number === ep.number;
                  return (
                    <Link
                      key={e.number}
                      href={`/hentai/${slug}/${e.number}`}
                      aria-current={isCur ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        isCur
                          ? "bg-accent/15 text-white"
                          : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-9 shrink-0 place-items-center rounded text-xs font-bold ${
                          isCur ? "bg-accent text-white" : "bg-surface-2 text-white/60"
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
