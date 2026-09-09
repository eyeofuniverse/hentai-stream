import type { Metadata } from "next";
import Link from "next/link";
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
  const studio = await db(() =>
    prisma.studio.findUnique({ where: { slug } }),
  ).catch(() => null);
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
  const studio = await db(() =>
    prisma.studio.findUnique({ where: { slug } }),
  ).catch(() => null);
  if (!studio) notFound();

  const { items, total, pages } = await browseSeries({
    studio: slug,
    sort: "updated",
  });

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          Studio
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {studio.name}
        </h1>
        {studio.description && (
          <p className="mt-2 max-w-2xl text-sm text-white/60">{studio.description}</p>
        )}
        <p className="mt-3 text-xs text-white/40">{total.toLocaleString()} series</p>
      </div>

      <SeriesGridLoadMore
        initial={items}
        totalPages={pages}
        query={{ studio: slug }}
      />

      <Link
        href="/browse"
        className="mt-10 inline-block text-xs text-white/40 hover:text-accent"
      >
        ← Browse everything
      </Link>
    </main>
  );
}
