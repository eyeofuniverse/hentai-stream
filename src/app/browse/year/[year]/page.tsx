import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import { SITE_NAME } from "@/lib/seo";

export const revalidate = 3600;

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

const MIN_YEAR = 1980;
const MAX_YEAR = new Date().getUTCFullYear() + 1;

function parseYear(raw: string): number | null {
  const y = Number(raw);
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) return null;
  return y;
}

function resolve(year: string, sp: SP) {
  const current: Record<string, string> = { year };
  for (const k of ["type", "status", "tag", "studio", "censored", "sort"]) {
    const v = one(sp, k);
    if (v) current[k] = v;
  }
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  return { current, page };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const { year: yearParam } = await params;
  const year = parseYear(yearParam);
  if (year == null) return { title: "Not found", robots: { index: false } };

  const { current, page } = resolve(String(year), await searchParams);
  const otherFilters = ["type", "status", "tag", "studio", "censored", "sort"].some(
    (k) => current[k],
  );
  const title = `Hentai from ${year}${page > 1 ? ` — Page ${page}` : ""}`;
  const qs = page > 1 ? `?page=${page}` : "";
  const canonical = `/browse/year/${year}${qs}`;

  return {
    title,
    description: `Every hentai series and OVA from ${year} on ${SITE_NAME} — free HD streaming, subbed and uncensored.`,
    alternates: { canonical },
    robots: { index: !otherFilters && page <= 3, follow: true },
    openGraph: { title, url: canonical },
  };
}

export default async function BrowseYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<SP>;
}) {
  const { year: yearParam } = await params;
  const year = parseYear(yearParam);
  if (year == null) notFound();

  const { current, page } = resolve(String(year), await searchParams);
  return (
    <BrowseView
      current={current}
      page={page}
      base={`/browse/year/${year}`}
      fixed={{ year: String(year) }}
      heading={`Hentai from ${year}`}
      crumbs={[{ name: String(year), path: `/browse/year/${year}` }]}
    />
  );
}
