import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries } from "@/lib/queries";
import { SeriesGridLoadMore } from "@/components/SeriesGridLoadMore";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const studios = await prisma.studio.findMany({ select: { slug: true } });
    return studios.map((s) => ({ slug: s.slug }));
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
  const studio = await db(() => prisma.studio.findUnique({ where: { slug } }));
  if (!studio) return { title: "Not found" };
  return {
    title: `${studio.name} — hentai series`,
    description:
      studio.description ?? `All hentai from ${studio.name}, streaming online.`,
    alternates: { canonical: `/studio/${slug}` },
  };
}

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const studio = await db(() => prisma.studio.findUnique({ where: { slug } }));
  if (!studio) notFound();

  const { items, total, pages } = await browseSeries({ studio: slug, sort: "updated" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold">{studio.name}</h1>
      {studio.description && (
        <p className="mt-2 max-w-2xl text-sm text-white/60">{studio.description}</p>
      )}
      <p className="mb-3 mt-3 text-xs text-white/40">{total} series</p>
      <SeriesGridLoadMore initial={items} totalPages={pages} query={{ studio: slug }} />
    </main>
  );
}
