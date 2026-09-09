import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries } from "@/lib/queries";
import { SeriesGridLoadMore } from "@/components/SeriesGridLoadMore";
import { gradientFor } from "@/lib/gradient";
import { SITE, SITE_NAME, breadcrumbLd } from "@/lib/seo";

export const revalidate = 600;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
  if (!tag) return { title: "Not found", robots: { index: false } };

  const title = tag.seoTitle || `${tag.name} Hentai — Watch Online`;
  const description =
    tag.seoDescription || tagDescription(tag.name, tag.seriesCount, tag.description);

  return {
    title,
    description,
    alternates: { canonical: `/tag/${slug}` },
    robots: { index: tag.seriesCount > 0, follow: true },
    openGraph: { title, description, url: `/tag/${slug}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
  if (!tag) notFound();

  const { items, total, pages } = await browseSeries({ tag: slug, sort: "updated" });
  const blurb = tagDescription(tag.name, total, tag.description);

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
        position: i + 1,
        url: `${SITE}/hentai/${s.slug}`,
        name: s.title,
      })),
    },
  };

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />

      <nav className="mb-4 text-xs text-white/40" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/tags" className="hover:text-white">Genres</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">{tag.name}</span>
      </nav>

      <div className="relative mb-8 overflow-hidden rounded-2xl border border-line p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 opacity-25" style={{ backgroundImage: gradientFor(slug) }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          {(tag.category ?? "genre").replace("_", " ").toLowerCase()}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tag.name} Hentai
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">{blurb}</p>
        <p className="mt-3 text-xs text-white/40">{total.toLocaleString()} series</p>
      </div>

      <SeriesGridLoadMore initial={items} totalPages={pages} query={{ tag: slug }} />

      <Link href="/tags" className="mt-10 inline-block text-xs text-white/40 hover:text-accent">
        ← All genres &amp; tags
      </Link>
    </main>
  );
}
