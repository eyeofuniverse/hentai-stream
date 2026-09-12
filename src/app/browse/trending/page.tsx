import type { Metadata } from "next";
import { BrowseView } from "@/components/BrowseView";
import { SITE_NAME } from "@/lib/seo";

export const revalidate = 300;

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

function resolve(sp: SP) {
  const current: Record<string, string> = { sort: "trending" };
  for (const k of ["type", "status", "tag", "studio", "year", "censored"]) {
    const v = one(sp, k);
    if (v) current[k] = v;
  }
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  return { current, page };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const { current, page } = resolve(await searchParams);
  const otherFilters = ["type", "status", "tag", "studio", "year", "censored"].some(
    (k) => current[k],
  );
  const title = `Trending Hentai Right Now${page > 1 ? ` — Page ${page}` : ""}`;
  const qs = page > 1 ? `?page=${page}` : "";
  const canonical = `/browse/trending${qs}`;

  return {
    title,
    description: `What's trending on ${SITE_NAME} right now — the hentai series getting the most attention today. Free HD streaming.`,
    alternates: { canonical },
    robots: { index: !otherFilters && page <= 3, follow: true },
    openGraph: { title, url: canonical },
  };
}

export default async function BrowseTrendingPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { current, page } = resolve(await searchParams);
  return (
    <BrowseView
      current={current}
      page={page}
      base="/browse/trending"
      fixed={{ sort: "trending" }}
      heading="Trending now"
      blurb="Ranked by recent views, freshness and score — what's actually getting watched right now."
      crumbs={[{ name: "Trending", path: "/browse/trending" }]}
    />
  );
}
