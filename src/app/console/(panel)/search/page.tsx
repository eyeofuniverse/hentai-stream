import Link from "next/link";
import { prisma, db } from "@/lib/db";
import {
  PageHeader,
  Card,
  SectionTitle,
  Badge,
  EmptyState,
  timeAgo,
} from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function SearchAnalyticsPage() {
  const [top, zero, total, tagRows] = await db(() =>
    Promise.all([
      prisma.searchTermStat.findMany({
        where: { lastResultCount: { gt: 0 } },
        orderBy: { count: "desc" },
        take: 60,
      }),
      prisma.searchTermStat.findMany({
        where: { lastResultCount: 0 },
        orderBy: [{ count: "desc" }, { lastSearchedAt: "desc" }],
        take: 60,
      }),
      prisma.searchTermStat.aggregate({ _sum: { count: true }, _count: true }),
      prisma.searchTermStat.groupBy({
        by: ["matchedTagSlug"],
        where: { matchedTagSlug: { not: null } },
        _sum: { count: true },
        orderBy: { _sum: { count: "desc" } },
        take: 25,
      }),
    ]),
  ).catch(() => [[], [], { _sum: { count: 0 }, _count: 0 }, []] as const);

  const tagSlugs = tagRows.map((r) => r.matchedTagSlug!).filter(Boolean);
  const tags = tagSlugs.length
    ? await db(() =>
        prisma.tag.findMany({
          where: { slug: { in: tagSlugs } },
          select: { slug: true, name: true },
        }),
      ).catch(() => [])
    : [];
  const tagName = Object.fromEntries(tags.map((t) => [t.slug, t.name]));

  const uniqueZero = zero.length;
  const zeroSearches = zero.reduce((n, z) => n + z.count, 0);

  return (
    <div>
      <PageHeader
        title="Search analytics"
        subtitle="What visitors are looking for. Zero-result terms are your content gaps — the fastest wins for what to add next."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Unique terms" value={total._count} />
        <Stat label="Total searches" value={total._sum.count ?? 0} />
        <Stat label="Zero-result terms" value={uniqueZero} tone="warn" />
        <Stat label="Zero-result searches" value={zeroSearches} tone="warn" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* content gaps */}
        <Card className="p-4">
          <SectionTitle>Content gaps — searched, nothing found</SectionTitle>
          {zero.length === 0 ? (
            <EmptyState title="No zero-result searches yet." />
          ) : (
            <ul className="divide-y divide-white/[0.06] text-sm">
              {zero.map((z) => (
                <li key={z.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-white/85">
                    {z.sample}
                  </span>
                  <a
                    href={`https://myanimelist.net/anime.php?q=${encodeURIComponent(z.sample)}&cat=anime`}
                    target="_blank"
                    rel="noopener"
                    className="shrink-0 text-xs text-white/30 hover:text-accent"
                  >
                    MAL ↗
                  </a>
                  <Badge tone="amber">×{z.count}</Badge>
                  <span className="shrink-0 text-xs text-white/25">
                    {timeAgo(z.lastSearchedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* top searched */}
        <Card className="p-4">
          <SectionTitle>Most searched — with results</SectionTitle>
          {top.length === 0 ? (
            <EmptyState title="No searches recorded yet." />
          ) : (
            <ul className="divide-y divide-white/[0.06] text-sm">
              {top.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2">
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/30">
                    ×{t.count}
                  </span>
                  <Link
                    href={`/search?q=${encodeURIComponent(t.sample)}`}
                    className="shrink-0 font-medium text-white/85 hover:text-accent"
                  >
                    {t.sample}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-white/35">
                    {t.topSeriesTitle ? `→ ${t.topSeriesTitle}` : ""}
                  </span>
                  {t.topSeriesId && (
                    <Link
                      href={`/console/series/${t.topSeriesId}`}
                      className="shrink-0 text-xs text-white/30 hover:text-white"
                    >
                      edit
                    </Link>
                  )}
                  <Badge tone="slate">{t.lastResultCount} hit</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* top tags */}
        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Most searched genres</SectionTitle>
          {tagRows.length === 0 ? (
            <EmptyState title="No genre searches recorded yet." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagRows.map((r) => (
                <Link
                  key={r.matchedTagSlug}
                  href={`/tag/${r.matchedTagSlug}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/80 hover:border-white/25"
                >
                  {tagName[r.matchedTagSlug!] ?? r.matchedTagSlug}
                  <span className="text-xs text-white/35">×{r._sum.count ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "warn" && value > 0
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-white/10 bg-surface"
      }`}
    >
      <div className="text-2xl font-bold tabular-nums text-white">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs text-white/45">{label}</div>
    </div>
  );
}
