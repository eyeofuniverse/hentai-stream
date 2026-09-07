import type { Metadata } from "next";
import { browseSeries, popularTags } from "@/lib/queries";
import { BrowseClient } from "@/components/BrowseClient";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Browse hentai",
  description: "Browse the full hentai catalogue by genre, studio, type and status.",
};

export default async function BrowsePage() {
  const [{ items, total, pages }, tags] = await Promise.all([
    browseSeries({ sort: "updated" }),
    popularTags(20),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Browse</h1>
      <BrowseClient
        initial={items}
        initialTotal={total}
        initialPages={pages}
        tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
      />
    </main>
  );
}
