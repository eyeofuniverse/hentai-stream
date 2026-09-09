import type { Metadata } from "next";
import { browseSeries, popularTags } from "@/lib/queries";
import { BrowseClient } from "@/components/BrowseClient";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Browse Hentai — Full Catalogue",
  description:
    "Browse every hentai series, OVA and movie — filter by genre, studio, type, status and year. Free HD streaming, subbed & uncensored.",
  alternates: { canonical: "/browse" },
  openGraph: { title: "Browse Hentai", url: "/browse" },
};

export default async function BrowsePage() {
  const [{ items, total, pages }, tags] = await Promise.all([
    browseSeries({ sort: "updated" }),
    popularTags(20),
  ]);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Browse</h1>
      <p className="mt-1 text-sm text-white/45">
        The full catalogue — filter it down to exactly what you want.
      </p>
      <div className="mt-6">
        <BrowseClient
          initial={items}
          initialTotal={total}
          initialPages={pages}
          tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
        />
      </div>
    </main>
  );
}
