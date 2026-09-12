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
  const current: Record<string, string> = { censored: "false" };
  for (const k of ["type", "status", "tag", "studio", "year", "sort"]) {
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
  const otherFilters = ["type", "status", "tag", "studio", "year", "sort"].some(
    (k) => current[k],
  );
  const title = `Uncensored Hentai${page > 1 ? ` — Page ${page}` : ""}`;
  const qs = page > 1 ? `?page=${page}` : "";
  const canonical = `/browse/uncensored${qs}`;

  return {
    title,
    description: `Every fully uncensored hentai series, OVA and movie on ${SITE_NAME} — free HD streaming, no blur, no mosaic censoring.`,
    alternates: { canonical },
    robots: { index: !otherFilters && page <= 3, follow: true },
    openGraph: { title, url: canonical },
  };
}

export default async function BrowseUncensoredPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { current, page } = resolve(await searchParams);
  return (
    <BrowseView
      current={current}
      page={page}
      base="/browse/uncensored"
      fixed={{ censored: "false" }}
      heading="Uncensored hentai"
      blurb="Every fully uncensored series, OVA and movie in the catalogue — free HD."
      crumbs={[{ name: "Uncensored", path: "/browse/uncensored" }]}
    />
  );
}
