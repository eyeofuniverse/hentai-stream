import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { browseSeries, sidebarData, type BrowseParams } from "@/lib/queries";
import { SeriesGrid } from "@/components/SeriesGrid";
import { Pagination } from "@/components/Pagination";
import { FilterBar } from "@/components/FilterBar";
import { CatalogSidebar } from "@/components/CatalogSidebar";
import { SITE_NAME, breadcrumbLd } from "@/lib/seo";

/**
 * Shared render for /browse and its dedicated SEO landing pages
 * (/browse/new, /browse/trending, /browse/uncensored, /browse/year/[year]).
 * `current` is the full resolved filter set (including whichever dimension
 * the calling route fixes) — used both for the query and to highlight the
 * right FilterBar chip. FilterBar itself always targets plain "/browse":
 * further filtering from a landing page intentionally drops into the
 * classic query-string experience rather than trying to keep composing
 * clean paths — pagination stays on the current clean path since that has
 * no "reset to default" ambiguity to worry about.
 */
export async function BrowseView({
  current,
  page,
  base = "/browse",
  fixed = {},
  heading,
  blurb,
  crumbs: extraCrumbs = [],
}: {
  current: Record<string, string>;
  page: number;
  base?: string;
  /** dimension(s) baked into `base` itself (e.g. sort:"new" on /browse/new) —
   *  left out of the query string so pagination/links don't restate them. */
  fixed?: Record<string, string>;
  heading: string;
  blurb?: string;
  crumbs?: { name: string; path: string }[];
}) {
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

  const resolvedBlurb =
    blurb ?? `${total.toLocaleString()} title${total === 1 ? "" : "s"} — filter down to exactly what you want.`;

  const makeHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) if (v && fixed[k] !== v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Browse", path: "/browse" },
    ...extraCrumbs,
  ]);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <nav className="mb-4 text-xs text-white/50" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/browse" className="hover:text-white">Browse</Link>
        {extraCrumbs.map((c) => (
          <span key={c.path}>
            <span className="mx-1.5">/</span>
            <span className="text-white/60">{c.name}</span>
          </span>
        ))}
      </nav>

      <h1 className="font-display text-2xl font-extrabold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-white/45">{resolvedBlurb}</p>

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
