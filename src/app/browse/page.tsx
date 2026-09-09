import type { Metadata } from "next";
import { browseSeries, popularTags, type BrowseParams } from "@/lib/queries";
import { BrowseClient } from "@/components/BrowseClient";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Browse Hentai — Full Catalogue",
  description:
    "Browse every hentai series, OVA and movie — filter by genre, studio, type, status and year. Free HD streaming, subbed & uncensored.",
  alternates: { canonical: "/browse" },
  openGraph: { title: "Browse Hentai", url: "/browse" },
};

type SP = Record<string, string | string[] | undefined>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };

  const initialFilters: Record<string, string> = {};
  for (const k of ["sort", "type", "status", "tag", "studio", "year", "censored"]) {
    const v = one(k);
    if (v) initialFilters[k] = v;
  }

  const [{ items, total, pages }, tags] = await Promise.all([
    browseSeries({
      sort: (initialFilters.sort as BrowseParams["sort"]) ?? "updated",
      type: initialFilters.type,
      status: initialFilters.status,
      tag: initialFilters.tag,
      studio: initialFilters.studio,
      year: initialFilters.year,
      censored: initialFilters.censored,
    }),
    popularTags(20),
  ]);

  const heading = initialFilters.censored === "false" ? "Uncensored hentai" : "Browse";
  const blurb =
    initialFilters.censored === "false"
      ? "Every fully uncensored series, OVA and movie in the catalogue."
      : "The full catalogue — filter it down to exactly what you want.";

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-white/45">{blurb}</p>
      <div className="mt-6">
        <BrowseClient
          initial={items}
          initialTotal={total}
          initialPages={pages}
          initialFilters={initialFilters}
          tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
        />
      </div>
    </main>
  );
}
