import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries, sidebarData, type BrowseParams } from "@/lib/queries";
import { SeriesGrid } from "@/components/SeriesGrid";
import { Pagination } from "@/components/Pagination";
import { CatalogSidebar } from "@/components/CatalogSidebar";
import { gradientFor } from "@/lib/gradient";
import { SITE, SITE_NAME, breadcrumbLd, socialMeta } from "@/lib/seo";

export const revalidate = 21600;
export const dynamicParams = true;

function parseSlug(slug: string): { season: string; year: number } | null {
  const m = /^(winter|spring|summer|fall)-(\d{4})$/i.exec(slug);
  if (!m) return null;
  return { season: m[1].toLowerCase(), year: Number(m[2]) };
}

function seasonLabel(season: string) {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

export async function generateStaticParams() {
  try {
    const rows = await prisma.series.groupBy({
      by: ["animeSeason", "seasonYear"],
      where: { publish: "PUBLISHED", animeSeason: { not: null }, seasonYear: { not: null } },
      _count: true,
    });
    return rows
      .filter((r) => r._count > 0)
      .map((r) => ({ slug: `${r.animeSeason!.toLowerCase()}-${r.seasonYear}` }));
  } catch {
    return [];
  }
}

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return { title: "Not found", robots: { index: false } };
  const page = Math.max(1, Number(one(await searchParams, "page")) || 1);

  const label = `${seasonLabel(parsed.season)} ${parsed.year}`;
  const base = `${label} Hentai — Every Series`;
  const title = page > 1 ? `${base} — Page ${page}` : base;
  const description = `Every hentai series that aired in ${label} — subbed & uncensored, free HD streaming on ${SITE_NAME}. Updated daily.`;
  const canonical = page > 1 ? `/season/${slug}?page=${page}` : `/season/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: page <= 5, follow: true },
    ...socialMeta({ title, description, path: canonical }),
  };
}

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  const sort = (one(sp, "sort") as BrowseParams["sort"]) ?? "updated";
  const label = `${seasonLabel(parsed.season)} ${parsed.year}`;

  const [{ items, total, pages }, sidebar] = await Promise.all([
    browseSeries({ season: parsed.season, seasonYear: String(parsed.year), sort, page }),
    sidebarData(),
  ]);
  if (total === 0 && page === 1) notFound();

  const blurb = `Every hentai series that aired in ${label} — subbed & uncensored, free HD streaming on ${SITE_NAME}. Updated daily.`;

  const makeHref = (p: number) => {
    const q = new URLSearchParams();
    if (sort && sort !== "updated") q.set("sort", sort);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/season/${slug}?${s}` : `/season/${slug}`;
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Seasons", path: "/season" },
    { name: `${label} Hentai`, path: `/season/${slug}` },
  ]);
  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} Hentai`,
    description: blurb,
    url: `${SITE}/season/${slug}`,
    isFamilyFriendly: false,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.slice(0, 20).map((s, i) => ({
        "@type": "ListItem",
        position: (page - 1) * 30 + i + 1,
        url: `${SITE}/hentai/${s.slug}`,
        name: s.title,
      })),
    },
  };

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />

      <nav className="mb-4 text-xs text-white/50" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/season" className="hover:text-white">Seasons</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">{label}</span>
      </nav>

      <div className="relative mb-6 overflow-hidden rounded-2xl border border-line p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 opacity-25" style={{ backgroundImage: gradientFor(slug) }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Season</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {label} Hentai
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">{blurb}</p>
        <p className="mt-3 text-xs text-white/50">
          {total.toLocaleString()} series{pages > 1 ? ` · page ${page} of ${pages}` : ""}
        </p>
      </div>

      <AdSlot slotKey="catalog-top" className="mb-6" />

      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap gap-1.5">
            {(
              [
                ["updated", "Recently updated"],
                ["new", "Newest"],
                ["popular", "Most viewed"],
                ["rating", "Top rated"],
              ] as const
            ).map(([v, l]) => (
              <Link
                key={v}
                href={v === "updated" ? `/season/${slug}` : `/season/${slug}?sort=${v}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  sort === v
                    ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
                    : "bg-surface text-white/60 hover:text-white"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>
          <SeriesGrid items={items} />
          <Pagination page={page} pages={pages} makeHref={makeHref} />
        </div>

        <div className="hidden w-72 shrink-0 space-y-6 lg:block">
          <div className="sticky top-20">
            <AdSlot slotKey="catalog-sidebar" label={false} />
          </div>
          <CatalogSidebar data={sidebar} bare />
        </div>
      </div>

      <AdSlot slotKey="catalog-footer" className="mt-10" />

      <Link href="/season" className="mt-10 inline-block text-xs text-white/50 hover:text-accent">
        ← All seasons
      </Link>
    </main>
  );
}
