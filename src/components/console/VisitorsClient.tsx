"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Globe, Users, Activity, TrendingUp, Zap, BarChart2 } from "lucide-react";
import type {
  VisitorData,
  VisitorGroup,
  RecentVisit,
  TopPage,
  CountryStat,
  DailyTraffic,
} from "@/lib/visitor-analytics";
import { Card, EmptyState } from "@/components/console/ui";

// ── helpers ──────────────────────────────────────────────────────────────

function flag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function timeAgo(iso: string, now: number) {
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "unknown";
  const diff = now - ts;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── sub-components ──────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  const c = tone ?? "#ff3d7f";
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ background: `${c}20`, color: c }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-white/45">{label}</p>
        <p className="text-xl font-bold leading-tight text-white">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-white/35">{sub}</p>}
      </div>
    </Card>
  );
}

function TrafficChart({ data, days }: { data: DailyTraffic[]; days: number }) {
  const max = Math.max(...data.map((d) => d.visits), 1);
  const show =
    days <= 14 ? data : data.filter((_, i) => i % Math.ceil(days / 14) === 0 || i === data.length - 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {show.map((d) => {
          const pct = (d.visits / max) * 100;
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full min-h-[3px] rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  background: d.date === today ? "#ff3d7f" : "rgba(255,61,127,0.35)",
                }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {fmtDate(d.date)}: {d.visits.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-white/35">
        <span>{fmtDate(data[0]?.date ?? "")}</span>
        <span>{fmtDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}

function VisitorTable({ visitors, now }: { visitors: VisitorGroup[]; now: number }) {
  if (visitors.length === 0) return <EmptyState title="No visitors yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {["IP Address", "Location", "Pages Visited", "Visits", "Last Seen"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-white/45">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visitors.map((v) => (
            <tr key={v.ip} className="border-b border-white/[0.06] transition-opacity hover:opacity-80">
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-white/85">{v.ip}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-white/85">
                <span className="mr-1">{flag(v.countryCode)}</span>
                <span>{v.country ?? <span className="text-white/35">Unknown</span>}</span>
                {v.city && <span className="ml-1 text-xs text-white/35">· {v.city}</span>}
              </td>
              <td className="max-w-xs px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {v.paths.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="max-w-[140px] truncate rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-white/45"
                    >
                      {p}
                    </span>
                  ))}
                  {v.paths.length > 3 && (
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">
                      +{v.paths.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-center font-semibold text-white/85">{v.visitCount}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/45">{timeAgo(v.lastSeen, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTable({ visits, now }: { visits: RecentVisit[]; now: number }) {
  if (visits.length === 0) return <EmptyState title="No activity yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {["Time", "IP Address", "Country", "Page"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-white/45">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr key={v.id} className="border-b border-white/[0.06] transition-opacity hover:opacity-80">
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/45">{timeAgo(v.visitedAt, now)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-white/85">{v.ip}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-white/85">
                <span className="mr-1">{flag(v.countryCode)}</span>
                {v.country ?? <span className="text-white/35">Unknown</span>}
              </td>
              <td className="max-w-xs truncate px-3 py-2.5 font-mono text-xs text-white/45">{v.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountriesTable({ countries, total }: { countries: CountryStat[]; total: number }) {
  if (countries.length === 0) return <EmptyState title="No country data yet." />;
  const max = countries[0]?.count ?? 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {["Country", "Visitors", "Share", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-white/45">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {countries.map((c) => (
            <tr key={c.country} className="border-b border-white/[0.06] transition-opacity hover:opacity-80">
              <td className="px-3 py-2.5 text-white/85">
                <span className="mr-2">{flag(c.countryCode)}</span>
                {c.country}
              </td>
              <td className="px-3 py-2.5 font-semibold text-white/85">{c.count.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-xs text-white/45">
                {total > 0 ? `${Math.round((c.count / total) * 100)}%` : "—"}
              </td>
              <td className="w-32 px-3 py-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(c.count / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPagesList({ pages }: { pages: TopPage[] }) {
  if (pages.length === 0) return <EmptyState title="No data yet." />;
  const max = pages[0]?.count ?? 1;
  return (
    <div className="space-y-2.5">
      {pages.map((p, i) => (
        <div key={p.path} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-right text-xs font-semibold text-white/35">{i + 1}</span>
          <span className="flex-1 truncate font-mono text-xs text-white/45" title={p.path}>
            {p.path}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(p.count / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-white/85">{p.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

const TABS = [
  { key: "visitors", label: "Visitors" },
  { key: "activity", label: "Activity" },
  { key: "countries", label: "Countries" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function VisitorsClient({ data: initialData }: { data: VisitorData }) {
  const [data, setData] = useState(initialData);
  const [activeDays, setActiveDays] = useState(initialData.days);
  const [tab, setTab] = useState<Tab>("visitors");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchRange = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/console/visitors?days=${days}`);
      if (res.ok) {
        setData(await res.json());
        setActiveDays(days);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-surface p-1">
          {RANGE_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => fetchRange(days)}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
              style={{
                background: activeDays === days ? "#ff3d7f" : "transparent",
                color: activeDays === days ? "white" : "rgba(255,255,255,0.45)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchRange(activeDays)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-medium text-white/45 transition-all hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Activity size={16} />} label="Total Visits" value={data.totalVisits.toLocaleString()} sub={`last ${activeDays}d`} />
        <StatCard icon={<Users size={16} />} label="Unique Visitors" value={data.uniqueVisitors.toLocaleString()} />
        <StatCard
          icon={<Zap size={16} />}
          label="Online Now"
          value={data.onlineNow}
          sub="last 5 minutes"
          tone={data.onlineNow > 0 ? "#22c55e" : undefined}
        />
        <StatCard icon={<TrendingUp size={16} />} label="Pages / Visitor" value={data.avgPagesPerVisitor} />
      </div>

      {/* daily traffic */}
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart2 size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-white">Daily Traffic</h2>
          <span className="ml-auto text-xs text-white/35">
            peak: {Math.max(...data.dailyTraffic.map((d) => d.visits)).toLocaleString()} visits
          </span>
        </div>
        <TrafficChart data={data.dailyTraffic} days={activeDays} />
      </Card>

      {/* main content */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-0 pt-3">
            <div className="flex gap-0.5">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative px-3 py-2 text-xs font-semibold transition-all"
                  style={{ color: tab === key ? "#ff3d7f" : "rgba(255,255,255,0.45)" }}
                >
                  {label}
                  {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-white/35">
              {tab === "visitors" && `${data.visitors.length} IPs`}
              {tab === "activity" && `last ${data.recentVisits.length} hits`}
              {tab === "countries" && `${data.topCountries.length} countries`}
            </span>
          </div>
          <div className="p-1">
            {tab === "visitors" && <VisitorTable visitors={data.visitors} now={now} />}
            {tab === "activity" && <ActivityTable visits={data.recentVisits} now={now} />}
            {tab === "countries" && <CountriesTable countries={data.topCountries} total={data.uniqueVisitors} />}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Globe size={14} className="text-accent" />
            <h2 className="text-sm font-semibold text-white">Top Pages</h2>
          </div>
          <TopPagesList pages={data.topPages} />
        </Card>
      </div>
    </div>
  );
}
