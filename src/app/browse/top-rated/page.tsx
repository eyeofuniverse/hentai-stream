import type { Metadata } from "next";
import { BrowseView } from "@/components/BrowseView";
import { SITE_NAME, socialMeta } from "@/lib/seo";

export const revalidate = 3600;

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

function resolve(sp: SP) {
  const current: Record<string, string> = { sort: "rating" };
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
  const title = `Top Rated Hentai${page > 1 ? ` — Page ${page}` : ""}`;
  const qs = page > 1 ? `?page=${page}` : "";
  const canonical = `/browse/top-rated${qs}`;

  const description = `The highest-rated hentai on ${SITE_NAME}, ranked by real viewer scores. Free HD streaming.${page > 1 ? ` — Page ${page}.` : ""}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !otherFilters && page <= 3, follow: true },
    ...socialMeta({ title, description, path: canonical }),
  };
}

export default async function BrowseTopRatedPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { current, page } = resolve(await searchParams);
  return (
    <BrowseView
      current={current}
      page={page}
      base="/browse/top-rated"
      fixed={{ sort: "rating" }}
      heading="Top rated"
      blurb="Ranked by real viewer ratings — the hentai people actually score the highest."
      crumbs={[{ name: "Top Rated", path: "/browse/top-rated" }]}
    />
  );
}
