import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, db } from "@/lib/db";
import { browseSeries } from "@/lib/queries";
import { SeriesGridLoadMore } from "@/components/SeriesGridLoadMore";
import { gradientFor } from "@/lib/gradient";

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
  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
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
  const tag = await db(() => prisma.tag.findUnique({ where: { slug } })).catch(
    () => null,
  );
  if (!tag) notFound();

  const { items, total, pages } = await browseSeries({ tag: slug, sort: "updated" });

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-line p-6 sm:p-8">
        <div
          className="absolute inset-0 -z-10 opacity-25"
          style={{ backgroundImage: gradientFor(slug) }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          {tag.category?.toLowerCase() ?? "genre"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tag.name} Hentai
        </h1>
        {tag.description && (
          <p className="mt-2 max-w-2xl text-sm text-white/60">{tag.description}</p>
        )}
        <p className="mt-3 text-xs text-white/40">{total.toLocaleString()} series</p>
      </div>

      <SeriesGridLoadMore initial={items} totalPages={pages} query={{ tag: slug }} />

      <Link
        href="/tags"
        className="mt-10 inline-block text-xs text-white/40 hover:text-accent"
      >
        ← All genres & tags
      </Link>
    </main>
  );
}
