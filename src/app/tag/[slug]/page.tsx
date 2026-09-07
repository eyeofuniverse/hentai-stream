import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries } from "@/lib/queries";
import { SeriesGridLoadMore } from "@/components/SeriesGridLoadMore";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const tags = await prisma.tag.findMany({ select: { slug: true } });
    return tags.map((t) => ({ slug: t.slug }));
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
  const tag = await db(() =>
    prisma.tag.findUnique({ where: { slug } }),
  ).catch(() => null);
  if (!tag) return { title: "Not found" };
  return {
    title: `${tag.name} Hentai`,
    description:
      tag.description ??
      `Browse ${tag.name} hentai series and episodes, subbed and uncensored.`,
    alternates: { canonical: `/tag/${slug}` },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await db(() =>
    prisma.tag.findUnique({ where: { slug } }),
  ).catch(() => null);
  if (!tag) notFound();

  const { items, total, pages } = await browseSeries({ tag: slug, sort: "updated" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold">{tag.name} Hentai</h1>
      {tag.description && (
        <p className="mt-2 max-w-2xl text-sm text-white/60">{tag.description}</p>
      )}
      <p className="mb-3 mt-3 text-xs text-white/40">{total} series</p>
      <SeriesGridLoadMore initial={items} totalPages={pages} query={{ tag: slug }} />
    </main>
  );
}
