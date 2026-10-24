"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Globe, Users, Activity, TrendingUp, Zap, BarChart2, AlertTriangle } from "lucide-react";
import type {
  VisitorData,
  VisitorGroup,
  RecentVisit,
  TopPage,
  CountryStat,
} from "@/lib/visitor-analytics";
import { Card, Stat, EmptyState, DailyTrendChart } from "@/components/console/ui";

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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ── sub-components ──────────────────────────────────────────────────────

// Rendering every row straight into the DOM (the data layer already caps at
// up to 10,000/20,000 for accurate aggregates) was producing 29,000+ real
// elements and a 130,000px-tall page — confirmed live, not theoretical.
// These tables are for a quick recent-activity scan, not a full export, so
// capping what actually renders is the fix, not paginating through 10k rows.
const DISPLAY_ROW_CAP = 150;

function TruncatedNote({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return (
    <p className="px-3 py-2 text-xs text-muted">
      Showing the most recent {shown.toLocaleString()} of {total.toLocaleString()}.
    </p>
  );
}

function VisitorTable({ visitors, now }: { visitors: VisitorGroup[]; now: number }) {
  if (visitors.length === 0) return <EmptyState title="No visitors yet." />;
  const shown = visitors.slice(0, DISPLAY_ROW_CAP);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {["IP Address", "Location", "Pages Visited", "Visits", "Avg Time/Page", "Total Time", "Last Seen"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((v) => (
            <tr key={`${v.ip}-${v.firstSeen}`} className="border-b border-white/[0.06] transition-opacity hover:opacity-80">
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-white/85">{v.ip}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-white/85">
                <span className="mr-1">{flag(v.countryCode)}</span>
                <span>{v.country ?? <span className="text-muted">Unknown</span>}</span>
                {v.city && <span className="ml-1 text-xs text-muted">· {v.city}</span>}
              </td>
              <td className="max-w-xs px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {v.paths.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="max-w-[140px] truncate rounded border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xs text-muted"
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
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/85">{fmtDuration(v.avgDurationSec)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-white/85">{fmtDuration(v.totalDurationSec)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted" title={new Date(v.lastSeen).toLocaleString()}>
                {fmtTime(v.lastSeen)} · {timeAgo(v.lastSeen, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TruncatedNote shown={shown.length} total={visitors.length} />
    </div>
  );
}

function ActivityTable({ visits, now }: { visits: RecentVisit[]; now: number }) {
  if (visits.length === 0) return <EmptyState title="No activity yet." />;
  const shown = visits.slice(0, DISPLAY_ROW_CAP);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {["Time", "IP Address", "Country", "Page", "Time Spent"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((v) => (
            <tr key={v.id} className="border-b border-white/[0.06] transition-opacity hover:opacity-80">
              <td
                className="whitespace-nowrap px-3 py-2.5 text-xs text-muted"
                title={new Date(v.visitedAt).toLocaleString()}
              >
                {fmtTime(v.visitedAt)} · {timeAgo(v.visitedAt, now)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-white/85">{v.ip}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-white/85">
                <span className="mr-1">{flag(v.countryCode)}</span>
                {v.country ?? <span className="text-muted">Unknown</span>}
              </td>
              <td className="max-w-xs truncate px-3 py-2.5 font-mono text-xs text-muted">{v.path}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/85">{fmtDuration(v.durationSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TruncatedNote shown={shown.length} total={visits.length} />
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
          <tr className="border-b border-line">
            {["Country", "Visitors", "Share", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted">
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
              <td className="px-3 py-2.5 text-xs text-muted">
                {total > 0 ? `${Math.round((c.count / total) * 100)}%` : "—"}
              </td>
              <td className="w-32 px-3 py-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
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
          <span className="w-4 shrink-0 text-right text-xs font-semibold text-muted">{i + 1}</span>
          <span className="flex-1 truncate font-mono text-xs text-muted" title={p.path}>
            {p.path}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
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
      {data.truncated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            This range has more visits than one query can hold — every number below is computed from
            only the most recent {data.totalVisits.toLocaleString()}, not the full {activeDays}-day
            range. Pick a shorter range for exact numbers.
          </span>
        </div>
      )}
      {/* header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
          {RANGE_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => fetchRange(days)}
              disabled={loading}
              aria-current={activeDays === days ? "page" : undefined}
              className="c-tab disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchRange(activeDays)}
          disabled={loading}
          className="c-btn-default disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon={<Activity size={16} />} label="Total Visits" value={data.totalVisits.toLocaleString()} sub={`last ${activeDays}d`} />
        <Stat icon={<Users size={16} />} label="Unique Visitors" value={data.uniqueVisitors.toLocaleString()} />
        <Stat
          icon={<Zap size={16} />}
          label="Online Now"
          value={data.onlineNow}
          sub="last 5 minutes"
          tone={data.onlineNow > 0 ? "good" : "neutral"}
        />
        <Stat icon={<TrendingUp size={16} />} label="Pages / Visit" value={data.avgPagesPerVisitor} />
        <Stat icon={<Zap size={16} />} label="Avg Time / Page" value={fmtDuration(data.avgDurationSec)} />
      </div>

      {/* daily traffic */}
      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart2 size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-white">Daily Traffic</h2>
          <span className="ml-auto text-xs text-muted">
            peak: {Math.max(...data.dailyTraffic.map((d) => d.visits)).toLocaleString()} visits
          </span>
        </div>
        <DailyTrendChart data={data.dailyTraffic} days={activeDays} />
      </Card>

      {/* main content */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-4 pb-0 pt-3">
            <div className="flex gap-0.5">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative px-3 py-2 text-xs font-semibold transition-colors ${tab === key ? "text-accent" : "text-muted hover:text-white"}`}
                >
                  {label}
                  {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-muted">
              {tab === "visitors" && `${data.visitors.length} visits (${data.uniqueVisitors} IPs)`}
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
