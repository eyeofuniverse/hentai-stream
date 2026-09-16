import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries, sidebarData } from "@/lib/queries";
import { img } from "@/lib/cloudinary";
import { SmartImg } from "@/components/SmartImg";
import { SeriesGrid } from "@/components/SeriesGrid";
import { Pagination } from "@/components/Pagination";
import { CatalogSidebar } from "@/components/CatalogSidebar";
import { SITE, SITE_NAME, breadcrumbLd, socialMeta } from "@/lib/seo";

export const revalidate = 21600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    // unfiltered — a page reading searchParams (pagination) combined with a
    // numeric revalidate can only be pre-rendered here; any slug this misses
    // hits Next's on-demand path at request time, which 500s
    // (DYNAMIC_SERVER_USAGE) rather than degrading to a plain dynamic render.
    // seriesCount is denormalized and can lag right after a bulk backfill, so
    // it must not gate this list the way it gates the sitemap.
    const characters = await prisma.character.findMany({
      select: { slug: true },
    });
    return characters.map((c) => ({ slug: c.slug }));
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
  const page = Math.max(1, Number(one(await searchParams, "page")) || 1);
  const character = await db(() =>
    prisma.character.findUnique({ where: { slug } }),
  ).catch(() => null);
  if (!character) return { title: "Not found", robots: { index: false } };

  const base = `${character.name} Hentai — Every Series & Episode`;
  const title = page > 1 ? `${base} — Page ${page}` : base;
  const description =
    character.description ||
    `Every hentai series and episode featuring ${character.name} — watch free in HD on ${SITE_NAME}.`;
  const canonical = page > 1 ? `/character/${slug}?page=${page}` : `/character/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: character.seriesCount > 0 && page <= 5, follow: true },
    ...socialMeta({ title, description, path: canonical }),
  };
}

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const page = Math.max(1, Number(one(await searchParams, "page")) || 1);
  const character = await db(() =>
    prisma.character.findUnique({ where: { slug } }),
  ).catch(() => null);
  if (!character) notFound();

  const [{ items, total, pages }, sidebar] = await Promise.all([
    browseSeries({ character: slug, sort: "updated", page }),
    sidebarData(),
  ]);

  const blurb =
    character.description ||
    `${character.name} appears in ${total.toLocaleString()} hentai title${
      total === 1 ? "" : "s"
    } on ${SITE_NAME}. Every one streams free in HD — subbed and uncensored, no account needed.`;

  const makeHref = (p: number) =>
    p > 1 ? `/character/${slug}?page=${p}` : `/character/${slug}`;

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
    { name: character.name, path: `/character/${slug}` },
  ]);
  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${character.name} Hentai`,
    description: blurb,
    url: `${SITE}/character/${slug}`,
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
        <Link href="/browse" className="hover:text-white">Browse</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">{character.name}</span>
      </nav>

      <div className="mb-6 flex items-start gap-4 border-b border-line pb-6">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:h-20 sm:w-20">
          <SmartImg
            src={img(character.imageUrl)}
            fallback={null}
            seed={character.slug}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Character</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {character.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">{blurb}</p>
          <p className="mt-3 text-xs text-white/50">
            {total.toLocaleString()} series{pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
        </div>
      </div>

      <AdSlot slotKey="catalog-top" className="mb-6" />

      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <SeriesGrid items={items} />
          <Pagination page={page} pages={pages} makeHref={makeHref} />
        </div>
        <div className="hidden w-72 shrink-0 space-y-6 lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overflow-x-hidden">
          <AdSlot slotKey="catalog-sidebar" label={false} />
          <CatalogSidebar data={sidebar} bare />
        </div>
      </div>

      <AdSlot slotKey="catalog-footer" className="mt-10" />

      <Link
        href="/browse"
        className="mt-10 inline-block text-xs text-white/50 hover:text-accent"
      >
        ← Browse everything
      </Link>
    </main>
  );
}
