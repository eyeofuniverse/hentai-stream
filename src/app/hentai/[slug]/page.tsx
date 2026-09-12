import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { notFound, permanentRedirect } from "next/navigation";
import { getSeries, relatedSeries } from "@/lib/queries";
import { findRedirect } from "@/lib/redirect-map";
import { prisma } from "@/lib/db";
import { cover, coverSet, banner, bannerSet, thumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";
import { Pill } from "@/components/ui";
import { SmartImg } from "@/components/SmartImg";
import { SeriesCard } from "@/components/SeriesCard";
import { SeriesControls } from "@/components/SeriesControls";
import { RatingBadge } from "@/components/RatingBadge";
import { Faq } from "@/components/seo/Faq";
import { seriesFaq } from "@/lib/faq";
import { Comments } from "@/components/comments/Comments";
import { SITE, SITE_NAME, abs, excerpt, breadcrumbLd } from "@/lib/seo";

export const revalidate = 7200;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const rows = await prisma.series.findMany({
      where: { publish: "PUBLISHED" },
      select: { slug: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeries(slug);
  if (!s) return { title: "Not found", robots: { index: false } };

  const cen = s.isCensored ? "" : " Uncensored";
  const title = `Watch ${s.title} Hentai${cen}${s.year ? ` (${s.year})` : ""}`;
  const genres = s.tags.slice(0, 4).map((t) => t.name).join(", ");
  const desc = excerpt(
    s.synopsis
      ? `${s.title} hentai${s.isCensored ? ", subbed" : " uncensored"}${
          s.year ? ` (${s.year})` : ""
        } — ${excerpt(s.synopsis, 180)}`
      : `Stream all ${s.episodes.length} episode${
          s.episodes.length === 1 ? "" : "s"
        } of ${s.title} hentai online${s.isCensored ? ", subbed" : " uncensored"}${
          genres ? `. ${genres}` : ""
        }. Free HD on ${SITE_NAME}.`,
    300,
  );
  return {
    title,
    description: desc,
    alternates: { canonical: `/hentai/${s.slug}` },
    openGraph: {
      title,
      description: desc,
      url: `/hentai/${s.slug}`,
      siteName: SITE_NAME,
      type: "video.tv_show",
      // image comes from opengraph-image.tsx in this route segment — a
      // properly-sized 1200x630 branded card, not the raw (often portrait,
      // often third-party-hotlinked) cover art
    },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSeries(slug);
  if (!s) {
    const to = await findRedirect(`/hentai/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }

  const related = await relatedSeries(
    s.id,
    s.tags.map((t) => t.slug),
    12,
  );

  const coverSrc = cover(s.coverUrl);
  const bannerSrc = banner(s.bannerUrl) ?? coverSrc;
  const rating = s.ratingCount > 0 ? s.ratingAvg : s.externalScore;
  const rt = s.episodes.find((e) => e.runtimeSec)?.runtimeSec;
  const runtimeMins = rt ? Math.round(rt / 60) : null;
  // main CTA lands on the first actually-playable episode
  const playableEp =
    s.episodes.find((e) => e.bunnyStatus === "ready" || e._count.sources > 0) ??
    s.episodes[0];
  const firstEp = playableEp?.number ?? 1;

  const genreNames = s.tags.map((t) => t.name);
  const seriesLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: s.title,
    alternateName: s.altTitles.length ? s.altTitles : undefined,
    description:
      s.synopsis ??
      `Watch ${s.title} hentai online — ${s.episodes.length} episode${
        s.episodes.length === 1 ? "" : "s"
      }, ${s.isCensored ? "subbed" : "uncensored"}, free HD on ${SITE_NAME}.`,
    image: coverSrc ? abs(coverSrc) : undefined,
    numberOfEpisodes: s.episodes.length,
    datePublished: s.releaseDate?.toISOString() ?? undefined,
    genre: genreNames.length ? genreNames : undefined,
    keywords: genreNames.join(", ") || undefined,
    inLanguage: "en",
    isFamilyFriendly: false,
    contentRating: "adult",
    productionCompany: s.studio
      ? { "@type": "Organization", name: s.studio.name }
      : undefined,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE },
    ...(s.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(s.ratingAvg.toFixed(2)),
            ratingCount: s.ratingCount,
            bestRating: 10,
            worstRating: 1,
          },
        }
      : {}),
    ...(s.episodes.length
      ? {
          episode: s.episodes.slice(0, 100).map((e) => ({
            "@type": "TVEpisode",
            episodeNumber: e.number,
            name: e.title || `Episode ${e.number}`,
            url: `${SITE}/hentai/${s.slug}/${e.number}`,
          })),
        }
      : {}),
    url: `${SITE}/hentai/${s.slug}`,
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
    { name: s.title, path: `/hentai/${s.slug}` },
  ]);

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      {/* backdrop */}
      <div className="relative isolate">
        <div className="absolute inset-0 -z-10 h-[420px] overflow-hidden opacity-30">
          <SmartImg
            src={bannerSrc}
            seed={s.slug}
            srcSet={
              (s.bannerUrl ? bannerSet(s.bannerUrl) : coverSet(s.coverUrl)) ?? undefined
            }
            sizes="100vw"
            alt=""
            className="h-full w-full object-cover blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-2 pt-6 lg:px-8">
          <nav className="mb-5 text-xs text-white/50">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-1.5">/</span>
            <Link href="/browse" className="hover:text-white">Browse</Link>
            <span className="mx-1.5">/</span>
            <span className="text-white/60">{s.title}</span>
          </nav>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            <div className="w-40 shrink-0 self-center sm:w-56 sm:self-start">
              <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface-2 shadow-card ring-1 ring-white/10">
                <SmartImg
                  src={coverSrc}
                  seed={s.slug}
                  srcSet={coverSet(s.coverUrl) ?? undefined}
                  sizes="(max-width:640px) 40vw, 224px"
                  alt={s.title}
                  width={300}
                  height={450}
                  eager
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {s.title}
              </h1>
              {s.altTitles.length > 0 && (
                <p className="mt-2 text-sm text-white/50">{s.altTitles.slice(0, 3).join(" · ")}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {rating ? (
                  <RatingBadge
                    score={rating}
                    votes={s.ratingCount || null}
                    source={s.ratingCount > 0 ? null : "mal"}
                    size="sm"
                  />
                ) : null}
                <Pill tone="accent">{s.type}</Pill>
                <Pill>{s.status[0] + s.status.slice(1).toLowerCase()}</Pill>
                {s.year && <Pill>{s.year}</Pill>}
                <Pill tone={s.isCensored ? "default" : "good"}>
                  {s.isCensored ? "Censored" : "Uncensored"}
                </Pill>
                <Pill>
                  {s.episodes.length} episode{s.episodes.length === 1 ? "" : "s"}
                </Pill>
                {s.studio && (
                  <Link href={`/studio/${s.studio.slug}`}>
                    <Pill className="hover:bg-white/15">{s.studio.name}</Pill>
                  </Link>
                )}
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70">
                {s.synopsis ??
                  `${s.title} is ${
                    /^[aeiou]/i.test(s.type) ? "an" : "a"
                  } ${s.type.toLowerCase()} hentai${s.year ? ` from ${s.year}` : ""}${
                    s.studio ? ` by ${s.studio.name}` : ""
                  }, ${s.isCensored ? "subbed" : "uncensored"}. Watch all ${
                    s.episodes.length
                  } episode${s.episodes.length === 1 ? "" : "s"} free in HD on ${SITE_NAME}.`}
              </p>

              {s.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
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

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {s.episodes.length > 0 && (
                  <Link
                    href={`/hentai/${s.slug}/${firstEp}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch episode {firstEp}
                  </Link>
                )}
              </div>

              <SeriesControls
                seriesId={s.id}
                avg={s.ratingAvg}
                count={s.ratingCount}
                className="mt-6 max-w-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* episodes */}
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 lg:px-8">
        <AdSlot slotKey="series-under-hero" className="mb-8" />

        <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
          Episodes
          <span className="text-sm font-normal text-white/50">
            {s.episodes.length}
          </span>
        </h2>

        {s.episodes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-white/50">
            No episodes published yet — check back soon.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {s.episodes.map((ep) => {
              const t =
                ep.bunnyStatus === "ready" && ep.bunnyGuid
                  ? bunnyThumb(ep.bunnyGuid)
                  : thumb(s.coverUrl);
              const mins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;
              return (
                <Link
                  key={ep.id}
                  href={`/hentai/${s.slug}/${ep.number}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2 transition hover:border-accent/40 hover:bg-surface"
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-32">
                    <SmartImg
                      src={t}
                      fallback={thumb(s.coverUrl)}
                      seed={`${s.slug}-${ep.number}`}
                      width={360}
                      height={203}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white drop-shadow">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 py-1 pr-2">
                    <p className="text-sm font-semibold text-white/85">
                      Episode {ep.number}
                      {ep.part > 1 && <span className="text-white/50"> · pt {ep.part}</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/45">
                      {ep.title || `${s.title} episode ${ep.number}`}
                    </p>
                    {mins && (
                      <p className="mt-1.5 text-[11px] text-white/50">{mins} min</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <AdSlot slotKey="series-under-episodes" className="mt-10" />

        {/* details + FAQ + related — real content, not a thin stub */}
        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
            About {s.title}
          </h2>
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <dl className="space-y-2 rounded-2xl border border-line bg-surface/40 p-4 text-sm">
              {(
                [
                  ["Type", s.type],
                  ["Status", s.status[0] + s.status.slice(1).toLowerCase()],
                  ["Year", s.year ?? "—"],
                  ["Episodes", s.episodes.length || "—"],
                  ["Runtime", runtimeMins ? `~${runtimeMins} min` : "—"],
                  ["Version", s.isCensored ? "Censored" : "Uncensored"],
                  [
                    "Source",
                    s.sourceMaterial
                      ? s.sourceMaterial.replace(/_/g, " ").toLowerCase()
                      : "—",
                  ],
                  ["Studio", s.studio?.name ?? "—"],
                  [
                    "Rating",
                    rating ? `${rating.toFixed(1)} / 10${s.ratingCount ? "" : " (MAL)"}` : "—",
                  ],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-white/50">{k}</dt>
                  <dd className="text-right font-medium capitalize text-white/75">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="text-sm leading-relaxed text-white/70">
              <p>
                {s.synopsis ??
                  `${s.title} is ${/^[aeiou]/i.test(s.type) ? "an" : "a"} ${s.type.toLowerCase()} hentai${
                    s.year ? ` from ${s.year}` : ""
                  }${s.studio ? ` produced by ${s.studio.name}` : ""}.`}
              </p>
              <p className="mt-3">
                All {s.episodes.length || ""} episode{s.episodes.length === 1 ? "" : "s"} of{" "}
                {s.title} stream free in HD on {SITE_NAME} — {s.isCensored ? "censored" : "uncensored"},
                no account needed, on desktop and mobile.
                {s.tags.length > 0 && (
                  <>
                    {" "}
                    If you like {s.title}, browse more{" "}
                    {s.tags.slice(0, 3).map((t, i) => (
                      <span key={t.slug}>
                        {i > 0 && ", "}
                        <Link href={`/tag/${t.slug}`} className="text-accent hover:underline">
                          {t.name.toLowerCase()}
                        </Link>
                      </span>
                    ))}{" "}
                    hentai.
                  </>
                )}
              </p>
              {s.altTitles.length > 0 && (
                <p className="mt-3 text-xs text-white/50">
                  Also known as: {s.altTitles.slice(0, 6).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </section>

        <Faq items={seriesFaq(s)} title={`${s.title} — FAQ`} />

        <Comments targetType="series" targetId={s.id} title="Discussion" />

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
              You might also like
            </h2>
            <div className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
              {related.map((r) => (
                <SeriesCard key={r.slug} series={r} />
              ))}
            </div>
          </section>
        )}

        <AdSlot slotKey="series-footer" className="mt-12" />
      </div>
    </main>
  );
}
