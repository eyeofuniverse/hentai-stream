import Link from "next/link";
import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";

/* ─────────────────────────── form field styles ─────────────────────────── */

export const inputCls =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 disabled:opacity-50";

export const labelCls =
  "grid gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45";

export function Field({
  label,
  hint,
  info,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  /** one-line explanation shown behind an (i) on hover / tap */
  info?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${labelCls} ${className}`}>
      <span className="flex items-center gap-1.5">
        {label}
        {info && <InfoTip text={info} />}
        {hint && (
          <span className="font-normal normal-case tracking-normal text-white/25">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────── surfaces ─────────────────────────────── */

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <As
      className={`min-w-0 rounded-xl border border-white/10 bg-surface ${className}`}
    >
      {children}
    </As>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-white/45">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-white/40">
        {children}
      </h2>
      {right}
    </div>
  );
}

/* ──────────────────────────────── stats ──────────────────────────────── */

export function Stat({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const active =
    tone !== "neutral" && typeof value === "number" && value > 0;
  const toneCls = active
    ? {
        good: "border-emerald-500/30 bg-emerald-500/5",
        warn: "border-amber-500/30 bg-amber-500/5",
        bad: "border-rose-500/30 bg-rose-500/5",
        neutral: "",
      }[tone]
    : "border-white/10 bg-surface";
  const inner = (
    <>
      <div className="text-2xl font-bold tabular-nums text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-0.5 text-xs text-white/45">{label}</div>
    </>
  );
  const cls = `block rounded-xl border p-4 transition-colors ${toneCls} ${
    href ? "hover:border-white/25" : ""
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ─────────────────────────────── badges ──────────────────────────────── */

const BADGE_TONES: Record<string, string> = {
  slate: "bg-white/10 text-white/55",
  green: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-rose-500/15 text-rose-300",
  violet: "bg-violet-500/15 text-violet-300",
  pink: "bg-accent/20 text-accent",
};

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        BADGE_TONES[tone] ?? BADGE_TONES.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}

const PUBLISH_TONE: Record<string, string> = {
  PUBLISHED: "green",
  PENDING: "amber",
  DRAFT: "slate",
  HIDDEN: "violet",
  REJECTED: "red",
};

export function PublishBadge({ status }: { status: string }) {
  return <Badge tone={PUBLISH_TONE[status] ?? "slate"}>{status}</Badge>;
}

const SOURCE_TONE: Record<string, string> = {
  ACTIVE: "green",
  PENDING: "amber",
  DEAD: "red",
  REJECTED: "slate",
};

export function SourceBadge({ status }: { status: string }) {
  return <Badge tone={SOURCE_TONE[status] ?? "slate"}>{status}</Badge>;
}

/** Where an episode's video actually comes from. */
export function HostBadge({
  bunnyStatus,
  hasHotlink,
}: {
  bunnyStatus: string | null;
  hasHotlink: boolean;
}) {
  if (bunnyStatus === "ready") return <Badge tone="green">Bunny</Badge>;
  if (bunnyStatus === "failed") return <Badge tone="red">host failed</Badge>;
  if (bunnyStatus) return <Badge tone="amber">encoding</Badge>;
  if (hasHotlink) return <Badge tone="violet">hotlink</Badge>;
  return <Badge tone="slate">no video</Badge>;
}

/* ───────────────────────────── empty state ───────────────────────────── */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 px-6 py-12 text-center">
      <p className="text-sm font-medium text-white/70">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-white/35">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────── charts ──────────────────────────────── */

/** GA-style "visits per day" trend — a day-by-day bar chart, the thing you
 *  actually want as the headline view of a date range, not just an
 *  hour-of-day distribution. Thins itself down to ~14 bars for longer
 *  ranges so a 90-day chart doesn't render 90 slivers. No hooks, so it's
 *  safe to use from both server and client components. */
export function DailyTrendChart({
  data,
  days,
  color = "#ff3d7f",
}: {
  data: { date: string; visits: number }[];
  days: number;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.visits), 1);
  const show =
    days <= 14 ? data : data.filter((_, i) => i % Math.ceil(days / 14) === 0 || i === data.length - 1);
  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

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
                  background: d.date === today ? color : `${color}59`,
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

/* ─────────────────────────────── buttons ─────────────────────────────── */

const BTN: Record<string, string> = {
  primary:
    "bg-accent text-white hover:bg-accent/90 focus-visible:ring-accent/40",
  secondary:
    "border border-white/15 bg-white/[0.03] text-white/80 hover:border-white/30 hover:text-white focus-visible:ring-white/20",
  ghost: "text-white/55 hover:bg-white/5 hover:text-white focus-visible:ring-white/20",
  danger:
    "border border-rose-500/30 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15 focus-visible:ring-rose-500/30",
};

export function btnCls(
  variant: keyof typeof BTN = "secondary",
  size: "sm" | "md" = "md",
) {
  const s = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return `inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold outline-none transition-colors focus-visible:ring-2 ${s} ${BTN[variant]}`;
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BTN;
  size?: "sm" | "md";
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      className={btnCls(variant, size)}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </Link>
  );
}

/* ──────────────────────────────── table ──────────────────────────────── */

export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-white/35">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

export function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

/* ──────────────────────────── filter tabs ────────────────────────────── */

export function FilterTabs({
  options,
  current,
  hrefFor,
}: {
  options: { value: string; label: string; count?: number }[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            current === o.value
              ? "bg-accent text-white"
              : "bg-white/[0.04] text-white/55 hover:bg-white/10 hover:text-white"
          }`}
        >
          {o.label}
          {typeof o.count === "number" && (
            <span
              className={`ml-1.5 tabular-nums ${
                current === o.value ? "text-white/70" : "text-white/30"
              }`}
            >
              {o.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/* ─────────────────────────────── misc ────────────────────────────────── */

export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-white/45">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-1.5">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className={btnCls("secondary", "sm")}>
            ← Prev
          </Link>
        )}
        {page < pages && (
          <Link href={hrefFor(page + 1)} className={btnCls("secondary", "sm")}>
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

export function timeAgo(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
