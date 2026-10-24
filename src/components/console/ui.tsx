import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { InfoTip } from "./InfoTip";

/** Presentation building blocks for every console screen — shared tokens
 *  (tailwind.config.ts) and the c- component classes (globals.css) so a
 *  color/spacing change happens in one place instead of N hardcoded copies. */

export type Tone = "good" | "warn" | "bad" | "info" | "accent" | "muted";

const TEXT: Record<Tone, string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
  accent: "text-accent",
  muted: "text-muted",
};
const FILL: Record<Tone, string> = {
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  accent: "bg-accent",
  muted: "bg-white/25",
};
/** Same fills at 35% opacity — spelled out as full literals so Tailwind's
 *  static scanner can see them (it can't resolve `FILL[tone] + "/35"`). */
const FILL_DIM: Record<Tone, string> = {
  good: "bg-good/35",
  warn: "bg-warn/35",
  bad: "bg-bad/35",
  info: "bg-info/35",
  accent: "bg-accent/35",
  muted: "bg-white/10",
};
const BADGE: Record<Tone, string> = {
  good: "c-badge-good",
  warn: "c-badge-warn",
  bad: "c-badge-bad",
  info: "c-badge-info",
  accent: "c-badge-accent",
  muted: "c-badge-muted",
};
const EDGE: Record<Tone, string> = {
  good: "#34d399",
  warn: "#fbbf24",
  bad: "#f87171",
  info: "#60a5fa",
  accent: "#ff3d7f",
  muted: "rgba(255,255,255,0.2)",
};

/* ─────────────────────────── form field styles ─────────────────────────── */

export const inputCls = "c-input";
export const labelCls = "c-label";

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
    <label className={`grid gap-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
        {info && <InfoTip text={info} />}
        {hint && <span className="font-normal normal-case tracking-normal text-white/25">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function SearchField({
  name,
  defaultValue,
  placeholder,
  className = "",
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="c-input pl-9" />
    </label>
  );
}

export function SelectField({
  name,
  label,
  defaultValue,
  children,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={defaultValue} className="c-input appearance-none pr-8">
        {children}
      </select>
    </label>
  );
}

/* ─────────────────────────────── surfaces ─────────────────────────────── */

export function Card({
  children,
  className = "",
  as: As = "div",
  edge,
  pad = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  /** a coloured left strip signalling what kind of card this is */
  edge?: Tone;
  pad?: boolean;
}) {
  return (
    <As
      className={`c-card ${edge ? "c-edge" : ""} ${pad ? "c-card-pad" : ""} ${className}`}
      style={edge ? ({ ["--c-edge" as string]: EDGE[edge] } as React.CSSProperties) : undefined}
    >
      {children}
    </As>
  );
}

export function PageHeader({
  title,
  subtitle,
  count,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  count?: number | string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-white">
          {title}
          {count !== undefined && (
            <span className="ml-2.5 align-middle text-base font-semibold text-muted">
              {typeof count === "number" ? count.toLocaleString() : count}
            </span>
          )}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {right}
    </div>
  );
}

/** An explanatory note: what a screen's actions do, in a tinted box calmer than a card. */
const NOTE_RING: Record<Tone, string> = {
  good: "bg-good/5 ring-good/20",
  warn: "bg-warn/5 ring-warn/20",
  bad: "bg-bad/5 ring-bad/20",
  info: "bg-info/5 ring-info/20",
  accent: "bg-accent/5 ring-accent/20",
  muted: "bg-surface-2/60 ring-line",
};
export function Note({ tone = "info", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`mb-5 flex gap-3 rounded-xl p-3.5 text-[13px] leading-relaxed text-muted ring-1 ring-inset ${NOTE_RING[tone]}`}>
      {icon && <span className={`mt-0.5 shrink-0 ${TEXT[tone]}`}>{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ──────────────────────────────── stats ──────────────────────────────── */

export function Stat({
  label,
  value,
  href,
  icon,
  sub,
  tone = "neutral",
  color,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon?: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | Tone;
  /** raw hex, for data-driven colors (one per category/device/etc.) that
   *  don't map onto the fixed Tone palette — takes precedence over tone */
  color?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        {icon && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 ${!color && (tone === "neutral" ? "text-muted" : TEXT[tone])}`}
            style={color ? { color } : undefined}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </>
  );
  const cls = "c-card c-card-pad block transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent/40`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Horizontal bars for a short ranked list (e.g. top sources, top tags). */
export function BarList({
  rows,
  tone = "accent",
  empty = "Nothing yet",
}: {
  rows: { label: string; value: number; href?: string }[];
  tone?: Tone;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-4 text-center text-xs text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const label = (
          <span className="min-w-0 flex-1 truncate text-[13px]" title={r.label}>
            {r.label}
          </span>
        );
        return (
          <li key={r.label} className="flex items-center gap-3">
            {r.href ? (
              <Link href={r.href} className="flex min-w-0 basis-28 items-center hover:text-accent sm:basis-32">
                {label}
              </Link>
            ) : (
              <span className="flex min-w-0 basis-28 items-center sm:basis-32">{label}</span>
            )}
            <span className="relative h-2 flex-[2] overflow-hidden rounded-full bg-surface-2">
              <span className={`absolute inset-y-0 left-0 rounded-full ${FILL[tone]}`} style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="w-14 text-right text-xs tabular-nums text-muted">{r.value.toLocaleString()}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A stacked proportion bar with a legend: how a whole splits into a few states. */
export function Split({ parts }: { parts: { label: string; value: number; tone: Tone }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {total > 0 &&
          parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={FILL[p.tone]} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${FILL[p.tone]}`} aria-hidden="true" />
            <span className="truncate text-muted">{p.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-white/85">{p.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────── badges ──────────────────────────────── */

export function Badge({ children, tone = "muted", dot = false, className = "" }: { children: ReactNode; tone?: Tone; dot?: boolean; className?: string }) {
  return (
    <span className={`${BADGE[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${FILL[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

const PUBLISH_TONE: Record<string, Tone> = { PUBLISHED: "good", PENDING: "warn", DRAFT: "muted", HIDDEN: "info", REJECTED: "bad" };
export function PublishBadge({ status }: { status: string }) {
  return <Badge tone={PUBLISH_TONE[status] ?? "muted"}>{status}</Badge>;
}

const SOURCE_TONE: Record<string, Tone> = { ACTIVE: "good", PENDING: "warn", DEAD: "bad", REJECTED: "muted" };
export function SourceBadge({ status }: { status: string }) {
  return <Badge tone={SOURCE_TONE[status] ?? "muted"}>{status}</Badge>;
}

/** Where an episode's video actually comes from. */
export function HostBadge({ bunnyStatus, hasHotlink }: { bunnyStatus: string | null; hasHotlink: boolean }) {
  if (bunnyStatus === "ready") return <Badge tone="good">Bunny</Badge>;
  if (bunnyStatus === "failed") return <Badge tone="bad">host failed</Badge>;
  if (bunnyStatus) return <Badge tone="warn">encoding</Badge>;
  if (hasHotlink) return <Badge tone="info">hotlink</Badge>;
  return <Badge tone="muted">no video</Badge>;
}

/* ───────────────────────────── empty state ───────────────────────────── */

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="c-card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}</span>
      <p className="font-display text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** A cover thumbnail with a graceful blank when there is none. */
export function Cover({ src, w = 48, h = 68, className = "" }: { src: string | null | undefined; w?: number; h?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" width={w} height={h} className={`shrink-0 rounded-lg bg-surface-2 object-cover ring-1 ring-line ${className}`} style={{ width: w, height: h }} />
  ) : (
    <div className={`grid shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] text-muted ring-1 ring-line ${className}`} style={{ width: w, height: h }} aria-hidden="true">
      none
    </div>
  );
}

/* ─────────────────────────────── charts ──────────────────────────────── */

/** GA-style "visits per day" trend as inline SVG — no chart library, so it
 *  costs nothing to load. Thins itself to ~14 bars for longer ranges. */
export function DailyTrendChart({ data, days, tone = "accent" }: { data: { date: string; visits: number }[]; days: number; tone?: Tone }) {
  const max = Math.max(...data.map((d) => d.visits), 1);
  const show = days <= 14 ? data : data.filter((_, i) => i % Math.ceil(days / 14) === 0 || i === data.length - 1);
  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {show.map((d) => {
          const pct = (d.visits / max) * 100;
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
              <div className={`w-full min-h-[3px] rounded-t-sm transition-all ${d.date === today ? FILL[tone] : FILL_DIM[tone]}`} style={{ height: `${Math.max(pct, 2)}%` }} />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {fmtDate(d.date)}: {d.visits.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{fmtDate(data[0]?.date ?? "")}</span>
        <span>{fmtDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────── buttons ─────────────────────────────── */

const BTN_CLASS: Record<string, string> = {
  primary: "c-btn-primary",
  secondary: "c-btn-default",
  ghost: "c-btn-ghost",
  danger: "c-btn-bad",
};

export function btnCls(variant: keyof typeof BTN_CLASS = "secondary", size: "sm" | "md" = "md") {
  const s = size === "sm" ? "!min-h-[32px] !px-2.5 !text-xs" : "";
  return `${BTN_CLASS[variant]} ${s}`;
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
  variant?: keyof typeof BTN_CLASS;
  size?: "sm" | "md";
  external?: boolean;
}) {
  return (
    <Link href={href} className={btnCls(variant, size)} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
    </Link>
  );
}

/* ──────────────────────────────── table ──────────────────────────────── */

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="c-card overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-white/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted">{head}</tr>
        </thead>
        <tbody className="c-divide">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

/* ──────────────────────────── tabs & paging ────────────────────────────── */

/** Segmented tabs made of links, so the state lives in the URL. */
export function Tabs({ items }: { items: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label="Sections" className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
        {items.map((t) => (
          <Link key={t.href} href={t.href} className="c-tab" aria-current={t.active ? "page" : undefined}>
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-md px-1.5 text-[11px] tabular-nums ${t.active ? "bg-accent text-white" : "bg-surface-3/60 text-muted"}`}>{t.count.toLocaleString()}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** @deprecated use Tabs for URL-driven sections */
export function FilterTabs({ options, current, hrefFor }: { options: { value: string; label: string; count?: number }[]; current: string; hrefFor: (value: string) => string }) {
  return <Tabs items={options.map((o) => ({ href: hrefFor(o.value), label: o.label, count: o.count, active: current === o.value }))} />;
}

/** Pagination that shows "1-20 of 453" when a total/pageSize are known, falling back to "Page N of M". */
export function Pager({ page, pages, hrefFor, total, pageSize }: { page: number; pages: number; hrefFor: (page: number) => string; total?: number; pageSize?: number }) {
  if (pages <= 1) return null;
  const from = total && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total && pageSize ? Math.min(total, page * pageSize) : null;
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
      <p className="text-xs text-muted">
        {from !== null && to !== null ? (
          <>
            <span className="tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span> of <span className="tabular-nums">{total!.toLocaleString()}</span>
          </>
        ) : (
          <>Page {page} of {pages}</>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="c-btn-default" rel="prev">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
          </Link>
        ) : (
          <button type="button" disabled className="c-btn-default">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
          </button>
        )}
        <span className="px-2 text-xs tabular-nums text-muted">{page} / {pages}</span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="c-btn-default" rel="next">
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" disabled className="c-btn-default">
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}

/** @deprecated use Pager for a range-aware footer */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  return <Pager page={page} pages={pages} hrefFor={hrefFor} />;
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
