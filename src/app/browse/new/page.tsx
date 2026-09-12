import type { Metadata } from "next";
import { BrowseView } from "@/components/BrowseView";
import { SITE_NAME } from "@/lib/seo";

export const revalidate = 1800;

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

function resolve(sp: SP) {
  const current: Record<string, string> = { sort: "new" };
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
  const title = `Newest Hentai Releases${page > 1 ? ` — Page ${page}` : ""}`;
  const qs = page > 1 ? `?page=${page}` : "";
  const canonical = `/browse/new${qs}`;

  return {
    title,
    description: `The newest hentai series and episodes just added to ${SITE_NAME} — sorted by most recently added. Free HD streaming, updated daily.`,
    alternates: { canonical },
    robots: { index: !otherFilters && page <= 3, follow: true },
    openGraph: { title, url: canonical },
  };
}

export default async function BrowseNewPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { current, page } = resolve(await searchParams);
  return (
    <BrowseView
      current={current}
      page={page}
      base="/browse/new"
      fixed={{ sort: "new" }}
      heading="Newest releases"
      blurb="Freshly added to the catalogue — sorted by the date it landed on LustHentai."
      crumbs={[{ name: "Newest", path: "/browse/new" }]}
    />
  );
}
