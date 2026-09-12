import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { browseSeries, sidebarData, type BrowseParams } from "@/lib/queries";
import { SeriesGrid } from "@/components/SeriesGrid";
import { Pagination } from "@/components/Pagination";
import { FilterBar } from "@/components/FilterBar";
import { CatalogSidebar } from "@/components/CatalogSidebar";
import { SITE_NAME, breadcrumbLd } from "@/lib/seo";

export const revalidate = 1800;

type SP = Record<string, string | string[] | undefined>;

const one = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  const unc = one(sp, "censored") === "false";
  const year = one(sp, "year");
  const tag = one(sp, "tag");

  // a genre filter has a real page of its own — send all the SEO signal there
  if (tag) {
    return {
      title: "Browse Hentai",
      alternates: { canonical: `/tag/${tag}` },
      robots: { index: false, follow: true },
    };
  }

  let title = unc ? "Uncensored Hentai" : "Browse Hentai — Full Catalogue";
  if (year) title = `${unc ? "Uncensored " : ""}Hentai (${year})`;
  if (page > 1) title += ` — Page ${page}`;

  const qs = new URLSearchParams();
  for (const k of ["year", "censored"]) {
    const v = one(sp, k);
    if (v) qs.set(k, v);
  }
  if (page > 1) qs.set("page", String(page));
  const canonical = `/browse${qs.toString() ? `?${qs}` : ""}`;

  // only index the clean views (bare / by-year / uncensored, first 3 pages);
  // arbitrary type+status+sort combos are just filtered slices, not new content
  const otherFilters = ["type", "status", "sort", "studio"].some((k) => one(sp, k));
  const indexable = !otherFilters && page <= 3;

  return {
    title,
    description: `Browse ${
      unc ? "fully uncensored " : ""
    }hentai series, OVAs and movies on ${SITE_NAME} — filter by genre, year, type and status. Free HD streaming, updated daily.`,
    alternates: { canonical },
    robots: { index: indexable, follow: true },
    openGraph: { title, url: canonical },
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const current: Record<string, string> = {};
  for (const k of ["sort", "type", "status", "tag", "studio", "year", "censored"]) {
    const v = one(sp, k);
    if (v) current[k] = v;
  }
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  // legacy ?sort=new / ?sort=trending / ?censored=false / ?year=YYYY single-
  // param URLs redirect to their dedicated page in middleware.ts — has to
  // happen there, not here: this route has a loading.tsx sibling, so by the
  // time this component's data resolves, Next has already started streaming
  // a 200 shell and a redirect() call here can only become a client-side
  // navigation, never a real HTTP 3xx a crawler would see.

  const [{ items, total, pages }, sidebar] = await Promise.all([
    browseSeries({
      sort: (current.sort as BrowseParams["sort"]) ?? "updated",
      type: current.type,
      status: current.status,
      tag: current.tag,
      studio: current.studio,
      year: current.year,
      censored: current.censored,
      page,
    }),
    sidebarData(),
  ]);

  const uncensored = current.censored === "false";
  const heading = uncensored
    ? "Uncensored hentai"
    : current.year
      ? `Hentai from ${current.year}`
      : "Browse the catalogue";
  const blurb = uncensored
    ? "Every fully uncensored series, OVA and movie in the catalogue — free HD."
    : `${total.toLocaleString()} title${total === 1 ? "" : "s"} — filter down to exactly what you want.`;

  const makeHref = (p: number) => {
    const q = new URLSearchParams(current);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/browse?${s}` : "/browse";
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
  ]);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <nav className="mb-4 text-xs text-white/50" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Browse</span>
      </nav>

      <h1 className="font-display text-2xl font-extrabold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-white/45">{blurb}</p>

      <AdSlot slotKey="catalog-top" className="mt-5" />

      <div className="mt-6 flex gap-8">
        <div className="min-w-0 flex-1">
          <FilterBar base="/browse" current={current} />
          <p className="mb-4 text-xs text-white/50">
            {total.toLocaleString()} result{total === 1 ? "" : "s"}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
          <SeriesGrid items={items} />
          <Pagination page={page} pages={pages} makeHref={makeHref} />
        </div>

        <div className="hidden w-72 shrink-0 space-y-6 lg:block">
          <CatalogSidebar data={sidebar} bare />
          <AdSlot slotKey="catalog-sidebar" label={false} />
        </div>
      </div>

      <AdSlot slotKey="catalog-footer" className="mt-10" />

      <p className="mt-10 text-sm leading-relaxed text-white/45">
        {SITE_NAME} is a free hentai streaming catalogue — {total.toLocaleString()} subbed
        and uncensored series, OVAs and movies, all playable in HD in your browser
        with no account. Use the filters above to sort by newest, most viewed or top
        rated, or narrow by genre, release year and type. New episodes are added every
        day. <Link href="/tags" className="text-accent hover:underline">Browse all genres</Link>.
      </p>
    </main>
  );
}
