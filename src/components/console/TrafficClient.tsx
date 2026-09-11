"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe, Monitor, Smartphone, Tablet, Link2, FileText, Clock,
  TrendingUp, RefreshCw, ExternalLink,
} from "lucide-react";
import type { TrafficData, TrafficSource, TopReferrer, DeviceStat, HourStat, TopPage } from "@/lib/visitor-analytics";
import { Card } from "@/components/console/ui";

const PERIODS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const CATEGORY_COLORS: Record<string, string> = {
  direct: "#6366f1",
  search: "#10b981",
  social: "#f59e0b",
  referral: "#3b82f6",
  internal: "#8b5cf6",
  "ad-network": "#ff3d7f",
};

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor size={14} />,
  mobile: <Smartphone size={14} />,
  tablet: <Tablet size={14} />,
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtHour(h: number) {
  const ap = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ap}`;
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  const c = color ?? "#ff3d7f";
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${c}20`, color: c }}>
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

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 w-[60px] overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
    </div>
  );
}

function SourcesPanel({ sources, total }: { sources: TrafficSource[]; total: number }) {
  const max = sources[0]?.count ?? 1;
  const grouped: Record<string, number> = {};
  for (const s of sources) grouped[s.category] = (grouped[s.category] ?? 0) + s.count;

  const categoryLabels: Record<string, string> = {
    direct: "Direct", search: "Organic Search", social: "Social Media",
    referral: "Referral", internal: "Internal", "ad-network": "Ad Network",
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Globe size={14} className="text-accent" />
        <h2 className="text-sm font-semibold text-white">Traffic Sources</h2>
        <span className="ml-auto text-xs tabular-nums text-white/35">{fmt(total)} total visits</span>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
        {Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
          <div
            key={cat}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: `${CATEGORY_COLORS[cat] ?? "#888"}18`, color: CATEGORY_COLORS[cat] ?? "#888" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] ?? "#888" }} />
            {categoryLabels[cat] ?? cat}: {fmt(count)}
          </div>
        ))}
      </div>

      {sources.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/35">
          No traffic data yet. It appears once visitors start arriving.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {sources.slice(0, 20).map((s) => {
            const color = CATEGORY_COLORS[s.category] ?? "#888";
            return (
              <div key={s.source} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="flex-1 truncate text-sm text-white/85">{s.source}</span>
                <HBar value={s.count} max={max} color={color} />
                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
                  {s.pct}%
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/45">{fmt(s.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ReferrersPanel({ referrers }: { referrers: TopReferrer[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Link2 size={14} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Top Referrers</h2>
      </div>
      {referrers.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/35">No external referrers yet.</div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {referrers.map((r, i) => (
            <div key={r.domain} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/35">{i + 1}</span>
              <a
                href={r.domain}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center gap-1 truncate text-sm text-white/85 hover:text-accent"
              >
                {r.domain.replace(/^https?:\/\//, "")}
                <ExternalLink size={10} className="shrink-0 text-white/35" />
              </a>
              <span className="shrink-0 text-xs tabular-nums text-white/35">{r.pct}%</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-blue-400">{fmt(r.count)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DevicesPanel({ devices }: { devices: DeviceStat[] }) {
  const deviceColors: Record<string, string> = { desktop: "#6366f1", mobile: "#10b981", tablet: "#f59e0b" };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Monitor size={14} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Device Breakdown</h2>
      </div>
      <div className="space-y-3 p-4">
        {devices.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/35">No data yet.</p>
        ) : (
          devices.map((d) => {
            const color = deviceColors[d.device] ?? "#888";
            return (
              <div key={d.device}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium capitalize text-white/85">
                    <span style={{ color }}>{DEVICE_ICONS[d.device] ?? <Monitor size={14} />}</span>
                    {d.device}
                  </span>
                  <span className="text-xs tabular-nums text-white/45">{fmt(d.count)} · {d.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(d.pct, 1)}%`, background: color }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function PeakHoursPanel({ hours }: { hours: HourStat[] }) {
  const max = Math.max(...hours.map((h) => h.count), 1);
  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Clock size={14} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Peak Hours</h2>
        {peakHour && max > 0 && (
          <span className="ml-auto text-xs text-white/35">Peak: {fmtHour(peakHour.hour)} UTC</span>
        )}
      </div>
      <div className="px-4 pb-3 pt-4">
        <div className="flex h-20 items-end gap-0.5">
          {hours.map(({ hour, count }) => {
            const pct = (count / max) * 100;
            const isPeak = hour === peakHour?.hour;
            return (
              <div key={hour} className="group relative flex flex-1 flex-col items-center">
                <div
                  className="w-full min-h-[3px] rounded-t-sm"
                  style={{ height: `${Math.max(pct, 2)}%`, background: isPeak ? "#f59e0b" : "rgba(245,158,11,0.3)" }}
                />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtHour(hour)}: {count}
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative mt-1" style={{ height: "14px" }}>
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h} className="absolute -translate-x-1/2 text-[9px] tabular-nums text-white/35" style={{ left: `${(h / 23) * 100}%` }}>
              {fmtHour(h)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TopPagesPanel({ pages }: { pages: TopPage[] }) {
  const max = pages[0]?.count ?? 1;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <FileText size={14} className="text-accent" />
        <h2 className="text-sm font-semibold text-white">Top Pages</h2>
      </div>
      {pages.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/35">No page data yet.</div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {pages.map((p, i) => (
            <div key={p.path} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/35">{i + 1}</span>
              <a
                href={p.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate font-mono text-xs text-white/85 hover:text-accent"
              >
                {p.path}
              </a>
              <HBar value={p.count} max={max} color="#ff3d7f" />
              <span className="shrink-0 text-xs font-semibold tabular-nums text-accent">{fmt(p.count)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TrafficClient({ data: initial }: { data: TrafficData }) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState(initial.days);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/console/traffic?days=${d}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // skip initial mount — SSR already provided data for the default period
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    load(days);
  }, [days, load]);

  const mobile = data.devices.find((d) => d.device === "mobile");
  const directSrc = data.sources.find((s) => s.source === "Direct");
  const topSrc = data.sources.filter((s) => s.category !== "direct" && s.category !== "internal")[0];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-white/45">
          {fmt(data.totalVisits)} page visits in the last {days === 1 ? "24 hours" : `${days} days`}
        </p>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={13} className="animate-spin text-white/35" />}
          <div className="flex gap-1">
            {PERIODS.map(({ label, days: d }) => (
              <button
                key={label}
                onClick={() => setDays(d)}
                className={`rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium transition-all ${
                  days === d ? "" : "bg-surface"
                }`}
                style={{
                  background: days === d ? "#ff3d7f" : undefined,
                  color: days === d ? "white" : "rgba(255,255,255,0.45)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<TrendingUp size={16} />} label="Total Visits" value={fmt(data.totalVisits)} color="#ff3d7f" />
        <StatCard
          icon={<Globe size={16} />}
          label="Top Source"
          value={topSrc?.source ?? directSrc?.source ?? "Direct"}
          sub={topSrc ? `${topSrc.pct}% of traffic` : undefined}
          color={CATEGORY_COLORS[topSrc?.category ?? "direct"]}
        />
        <StatCard
          icon={<Smartphone size={16} />}
          label="Mobile Share"
          value={mobile ? `${mobile.pct}%` : "—"}
          sub={mobile ? `${fmt(mobile.count)} visits` : undefined}
          color="#10b981"
        />
        <StatCard
          icon={<Link2 size={16} />}
          label="Direct Traffic"
          value={directSrc ? `${directSrc.pct}%` : "—"}
          sub={directSrc ? `${fmt(directSrc.count)} visits` : undefined}
          color="#6366f1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SourcesPanel sources={data.sources} total={data.totalVisits} />
        <div className="space-y-6">
          <DevicesPanel devices={data.devices} />
          <PeakHoursPanel hours={data.peakHours} />
        </div>
        <ReferrersPanel referrers={data.topReferrers} />
        <TopPagesPanel pages={data.topPages} />
      </div>
    </div>
  );
}
