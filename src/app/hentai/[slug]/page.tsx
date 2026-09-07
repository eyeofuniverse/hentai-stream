import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeries } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { cover, banner } from "@/lib/cloudinary";

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
  const bannerSrc = banner(s.bannerUrl);

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
    productionCompany: s.studio ? { "@type": "Organization", name: s.studio.name } : undefined,
    url: `${SITE}/hentai/${s.slug}`,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {bannerSrc && (
        <div className="relative -mx-4 mb-6 h-40 overflow-hidden sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerSrc} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
        </div>
      )}

      <nav className="mb-3 text-xs text-white/40">
        <Link href="/">Home</Link> / <Link href="/browse">Browse</Link> / {s.title}
      </nav>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-40 shrink-0 self-start sm:w-52">
          <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-2">
            {coverSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt={s.title} className="h-full w-full object-cover" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{s.title}</h1>
          {s.altTitles.length > 0 && (
            <p className="mt-1 text-sm text-white/45">{s.altTitles.join(" · ")}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Meta>{s.type}</Meta>
            <Meta>{s.status[0] + s.status.slice(1).toLowerCase()}</Meta>
            {s.year && <Meta>{s.year}</Meta>}
            <Meta>{s.isCensored ? "Censored" : "Uncensored"}</Meta>
            {s.studio && (
              <Link href={`/studio/${s.studio.slug}`} className="rounded-full bg-surface px-2.5 py-1 hover:bg-surface-2">
                {s.studio.name}
              </Link>
            )}
          </div>

          {s.synopsis && (
            <p className="mt-4 text-sm leading-relaxed text-white/75">{s.synopsis}</p>
          )}

          {s.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <Link
                  key={t.slug}
                  href={`/tag/${t.slug}`}
                  className="rounded-full bg-surface px-2.5 py-1 text-xs text-white/70 hover:bg-surface-2 hover:text-white"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Episodes</h2>
      {s.episodes.length === 0 ? (
        <p className="text-sm text-white/40">No episodes published yet.</p>
      ) : (
        <div className="grid gap-2">
          {s.episodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/hentai/${s.slug}/${ep.number}`}
              className="flex items-center gap-3 rounded-lg border border-white/8 bg-surface px-3 py-2.5 text-sm hover:border-accent/40"
            >
              <span className="grid h-7 w-9 shrink-0 place-items-center rounded bg-surface-2 text-xs font-bold">
                {ep.number}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {ep.title ?? `Episode ${ep.number}`}
              </span>
              {ep._count.sources === 0 && (
                <span className="shrink-0 text-[10px] text-white/30">no sources</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface px-2.5 py-1">{children}</span>;
}
