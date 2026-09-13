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
import { SITE, SITE_NAME, breadcrumbLd } from "@/lib/seo";

export const revalidate = 21600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const tags = await prisma.tag.findMany({
      where: { seriesCount: { gt: 0 } },
      select: { slug: true },
    });
    return tags.map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

function tagDescription(name: string, count: number, custom?: string | null) {
  if (custom) return custom;
  return `Watch ${count.toLocaleString()} ${name} hentai series and OVAs online — subbed & uncensored, free HD streaming on ${SITE_NAME}. Updated daily.`;
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
  const page = Math.max(1, Number(one(await searchParams, "page")) || 1);
  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
  if (!tag) return { title: "Not found", robots: { index: false } };

  const base = tag.seoTitle || `${tag.name} Hentai — Watch Online`;
  const title = page > 1 ? `${base} — Page ${page}` : base;
  const description =
    tag.seoDescription || tagDescription(tag.name, tag.seriesCount, tag.description);

  return {
    title,
    description,
    alternates: { canonical: page > 1 ? `/tag/${slug}?page=${page}` : `/tag/${slug}` },
    robots: { index: tag.seriesCount > 0 && page <= 5, follow: true },
    openGraph: { title, description, url: `/tag/${slug}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  const sort = (one(sp, "sort") as BrowseParams["sort"]) ?? "updated";

  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
  if (!tag) notFound();

  const [{ items, total, pages }, sidebar] = await Promise.all([
    browseSeries({ tag: slug, sort, page }),
    sidebarData(),
  ]);
  const blurb = tagDescription(tag.name, total, tag.description);

  const makeHref = (p: number) => {
    const q = new URLSearchParams();
    if (sort && sort !== "updated") q.set("sort", sort);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/tag/${slug}?${s}` : `/tag/${slug}`;
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Genres", path: "/tags" },
    { name: `${tag.name} Hentai`, path: `/tag/${slug}` },
  ]);
  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${tag.name} Hentai`,
    description: blurb,
    url: `${SITE}/tag/${slug}`,
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
        <Link href="/tags" className="hover:text-white">Genres</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">{tag.name}</span>
      </nav>

      <div className="relative mb-6 overflow-hidden rounded-2xl border border-line p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 opacity-25" style={{ backgroundImage: gradientFor(slug) }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          {(tag.category ?? "genre").replace("_", " ").toLowerCase()}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tag.name} Hentai
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
                href={v === "updated" ? `/tag/${slug}` : `/tag/${slug}?sort=${v}`}
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
          <CatalogSidebar data={sidebar} bare />
          <AdSlot slotKey="catalog-sidebar" label={false} />
        </div>
      </div>

      <AdSlot slotKey="catalog-footer" className="mt-10" />

      <Link href="/tags" className="mt-10 inline-block text-xs text-white/50 hover:text-accent">
        ← All genres &amp; tags
      </Link>
    </main>
  );
}
