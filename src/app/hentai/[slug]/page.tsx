import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeries } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { cover, banner, thumb } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";
import { Pill } from "@/components/ui";

export const revalidate = 600;
export const dynamicParams = true;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  if (!s) return { title: "Not found" };

  const title = `Watch ${s.title} Hentai${s.year ? ` (${s.year})` : ""}`;
  const desc =
    s.synopsis?.slice(0, 155) ??
    `Stream all ${s.episodes.length} episodes of ${s.title} hentai online, subbed and uncensored.`;

  return {
    title,
    description: desc,
    alternates: { canonical: `/hentai/${s.slug}` },
    openGraph: {
      title,
      description: desc,
      url: `/hentai/${s.slug}`,
      images: cover(s.coverUrl) ? [cover(s.coverUrl)!] : [],
      type: "video.tv_show",
    },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSeries(slug);
  if (!s) notFound();

  const coverSrc = cover(s.coverUrl);
  const bannerSrc = banner(s.bannerUrl) ?? coverSrc;
  const firstEp = s.episodes[0]?.number ?? 1;
  const playable = s.episodes.filter((e) => e._count.sources > 0).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: s.title,
    alternateName: s.altTitles,
    description: s.synopsis ?? undefined,
    image: coverSrc ?? undefined,
    numberOfEpisodes: s.episodes.length,
    datePublished: s.releaseDate?.toISOString() ?? undefined,
    genre: s.tags.map((t) => t.name),
    productionCompany: s.studio
      ? { "@type": "Organization", name: s.studio.name }
      : undefined,
    url: `${SITE}/hentai/${s.slug}`,
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* backdrop */}
      <div className="relative isolate">
        <div className="absolute inset-0 -z-10 h-[420px] overflow-hidden">
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerSrc} alt="" className="h-full w-full object-cover opacity-30 blur-sm" />
          ) : (
            <div className="h-full w-full opacity-30" style={{ backgroundImage: gradientFor(s.slug) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-2 pt-6 lg:px-8">
          <nav className="mb-5 text-xs text-white/40">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-1.5">/</span>
            <Link href="/browse" className="hover:text-white">Browse</Link>
            <span className="mx-1.5">/</span>
            <span className="text-white/60">{s.title}</span>
          </nav>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            <div className="w-40 shrink-0 self-center sm:w-56 sm:self-start">
              <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface-2 shadow-card ring-1 ring-white/10">
                {coverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverSrc} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ backgroundImage: gradientFor(s.slug) }} />
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {s.title}
              </h1>
              {s.altTitles.length > 0 && (
                <p className="mt-2 text-sm text-white/40">{s.altTitles.slice(0, 3).join(" · ")}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
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

              {s.synopsis && (
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70">
                  {s.synopsis}
                </p>
              )}

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

              {s.episodes.length > 0 && (
                <Link
                  href={`/hentai/${s.slug}/${firstEp}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch episode {firstEp}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* episodes */}
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 lg:px-8">
        <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
          Episodes
          <span className="text-sm font-normal text-white/35">
            {playable} of {s.episodes.length} playable
          </span>
        </h2>

        {s.episodes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-white/40">
            No episodes published yet — check back soon.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {s.episodes.map((ep) => {
              const src = thumb(ep.thumbUrl) ?? thumb(s.coverUrl);
              const noSrc = ep._count.sources === 0;
              const mins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;
              return (
                <Link
                  key={ep.id}
                  href={`/hentai/${s.slug}/${ep.number}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2 transition hover:border-accent/40 hover:bg-surface"
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-32">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full" style={{ backgroundImage: gradientFor(s.slug) }} />
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white drop-shadow">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 py-1 pr-2">
                    <p className="text-sm font-semibold text-white/85">
                      Episode {ep.number}
                      {ep.part > 1 && <span className="text-white/40"> · pt {ep.part}</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/45">
                      {ep.title || `${s.title} episode ${ep.number}`}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/35">
                      {mins && <span>{mins} min</span>}
                      {noSrc ? (
                        <span className="text-warn/80">awaiting source</span>
                      ) : (
                        <span className="text-good/80">● ready</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
