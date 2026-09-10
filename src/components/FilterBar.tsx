import Link from "next/link";

export type Filters = Record<string, string | undefined>;

const SORTS: [string, string][] = [
  ["updated", "Updated"],
  ["new", "Newest"],
  ["popular", "Most viewed"],
  ["trending", "Trending"],
  ["rating", "Top rated"],
  ["az", "A–Z"],
];
const TYPES = ["OVA", "ONA", "MOVIE", "SPECIAL", "SERIES"];
const STATUSES = ["ONGOING", "COMPLETED", "HIATUS"];

function href(base: string, current: Filters, patch: Filters): string {
  const q = new URLSearchParams();
  const merged: Filters = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== "page") q.set(k, v);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

function Chip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${
        active
          ? "bg-accent text-white"
          : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Link-based catalogue filters — no client JS, every state is a real URL.
 *  Genres live in the sidebar + on /tags, so they're not repeated here. */
export function FilterBar({
  base,
  current,
}: {
  base: string;
  current: Filters;
}) {
  const active = Object.keys(current).filter(
    (k) => k !== "sort" && k !== "page" && current[k],
  ).length;

  return (
    <details
      className="group mb-6 overflow-hidden rounded-xl border border-line bg-surface/30 [&_summary]:list-none"
      open
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 lg:cursor-default">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Filters
          {active > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
              {active}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          {active > 0 && (
            <Link
              href={base}
              className="text-xs font-medium text-accent hover:underline"
            >
              Clear
            </Link>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-white/30 transition-transform group-open:rotate-180 lg:hidden"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>

      <div className="grid gap-x-6 gap-y-4 border-t border-line px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Group label="Sort by">
          {SORTS.map(([v, l]) => (
            <Chip
              key={v}
              active={(current.sort ?? "updated") === v}
              to={href(base, current, { sort: v === "updated" ? undefined : v })}
            >
              {l}
            </Chip>
          ))}
        </Group>
        <Group label="Type">
          <Chip active={!current.type} to={href(base, current, { type: undefined })}>
            All
          </Chip>
          {TYPES.map((t) => (
            <Chip
              key={t}
              active={current.type === t.toLowerCase()}
              to={href(base, current, { type: t.toLowerCase() })}
            >
              {t}
            </Chip>
          ))}
        </Group>
        <Group label="Status">
          <Chip active={!current.status} to={href(base, current, { status: undefined })}>
            All
          </Chip>
          {STATUSES.map((s) => (
            <Chip
              key={s}
              active={current.status === s.toLowerCase()}
              to={href(base, current, { status: s.toLowerCase() })}
            >
              {s[0] + s.slice(1).toLowerCase()}
            </Chip>
          ))}
        </Group>
        <Group label="Version">
          <Chip active={!current.censored} to={href(base, current, { censored: undefined })}>
            All
          </Chip>
          <Chip
            active={current.censored === "false"}
            to={href(base, current, { censored: "false" })}
          >
            Uncensored
          </Chip>
          <Chip
            active={current.censored === "true"}
            to={href(base, current, { censored: "true" })}
          >
            Censored
          </Chip>
        </Group>
      </div>
    </details>
  );
}
