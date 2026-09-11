import Link from "next/link";
import { Eye, Heart, MessageCircle, Star, Users, Globe, Tag, Building2, Search } from "lucide-react";
import { getVisitorData, getTrafficAnalytics } from "@/lib/visitor-analytics";
import { getTagPerformance, getStudioPerformance } from "@/lib/analytics-queries";
import { VisitorsClient } from "@/components/console/VisitorsClient";
import { TrafficClient } from "@/components/console/TrafficClient";
import { PageHeader, Card, Badge, EmptyState } from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const TABS = [
  { key: "visitors", label: "Visitors", icon: Users },
  { key: "traffic", label: "Traffic", icon: Globe },
  { key: "tags", label: "Tags", icon: Tag },
  { key: "studios", label: "Studios", icon: Building2 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const TH = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/45";
const THR = "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/45";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "visitors") as TabKey;

  const [visitorData, trafficData, tagData, studioData] = await Promise.all([
    activeTab === "visitors" ? getVisitorData(7) : Promise.resolve(null),
    activeTab === "traffic" ? getTrafficAnalytics(7) : Promise.resolve(null),
    activeTab === "tags" ? getTagPerformance() : Promise.resolve(null),
    activeTab === "studios" ? getStudioPerformance() : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Visitors, traffic sources, and what's actually performing on the site."
        actions={
          <Link
            href="/console/search"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white"
          >
            <Search size={13} /> Search analytics →
          </Link>
        }
      />

      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-white/10 bg-surface p-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <Link
              key={key}
              href={`/console/analytics?tab=${key}`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all"
              style={{
                background: active ? "rgba(255,61,127,0.12)" : "transparent",
                color: active ? "#ff3d7f" : "rgba(255,255,255,0.55)",
              }}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      {activeTab === "visitors" && visitorData && <VisitorsClient data={visitorData} />}
      {activeTab === "traffic" && trafficData && <TrafficClient data={trafficData} />}

      {activeTab === "tags" && tagData && (
        <PerformanceTable
          rows={tagData}
          countLabel="tags"
          hrefFor={(r) => `/tag/${r.slug}`}
          extraBadge={(r) =>
            r.category ? <Badge tone="slate">{r.category.replace("_", " ").toLowerCase()}</Badge> : null
          }
        />
      )}

      {activeTab === "studios" && studioData && (
        <PerformanceTable rows={studioData} countLabel="studios" hrefFor={(r) => `/studio/${r.slug}`} />
      )}
    </div>
  );
}

type PerfRow = {
  id: string;
  name: string;
  slug: string;
  seriesCount: number;
  totalViews: number;
  totalFavorites: number;
  totalComments: number;
  avgRating: number;
  category?: string;
};

function PerformanceTable({
  rows,
  countLabel,
  hrefFor,
  extraBadge,
}: {
  rows: PerfRow[];
  countLabel: string;
  hrefFor: (r: PerfRow) => string;
  extraBadge?: (r: PerfRow) => React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-white/45">
        {rows.length} {countLabel} — sorted by total views
      </p>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="Nothing to show yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={`${TH} w-6`}>#</th>
                  <th className={TH}>Name</th>
                  <th className={THR}>Series</th>
                  <th className={THR}>Total Views</th>
                  <th className={`${THR} hidden sm:table-cell`}>Favorites</th>
                  <th className={`${THR} hidden md:table-cell`}>Comments</th>
                  <th className={`${THR} hidden lg:table-cell`}>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-white/[0.06]">
                    <td className="px-4 py-3 text-xs tabular-nums text-white/35">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={hrefFor(r)} target="_blank" className="text-sm font-medium text-white/85 hover:text-accent">
                        {r.name}
                      </Link>
                      {extraBadge && <span className="ml-2">{extraBadge(r)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-white/45">
                      {r.seriesCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="flex items-center justify-end gap-1 text-sm font-semibold text-white/85">
                        <Eye size={11} className="text-white/35" />
                        {r.totalViews.toLocaleString()}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs tabular-nums text-white/45 sm:table-cell">
                      <span className="flex items-center justify-end gap-1">
                        <Heart size={10} /> {r.totalFavorites.toLocaleString()}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs tabular-nums text-white/45 md:table-cell">
                      <span className="flex items-center justify-end gap-1">
                        <MessageCircle size={10} /> {r.totalComments.toLocaleString()}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs tabular-nums lg:table-cell">
                      {r.avgRating > 0 ? (
                        <span className="flex items-center justify-end gap-1 font-semibold text-accent">
                          <Star size={10} fill="currentColor" /> {r.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
