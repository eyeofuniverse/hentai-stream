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
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
          : "bg-surface text-white/60 hover:bg-surface-2 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/35">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Link-based catalogue filters — no client JS, every state is a real URL. */
export function FilterBar({
  base,
  current,
  genres,
  showGenre = true,
}: {
  base: string;
  current: Filters;
  genres: { slug: string; name: string }[];
  showGenre?: boolean;
}) {
  const active = Object.keys(current).filter(
    (k) => k !== "sort" && k !== "page" && current[k],
  ).length;

  return (
    <details className="mb-6 rounded-2xl border border-line bg-surface/40 [&_summary]:list-none" open>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 lg:cursor-default">
        <span className="text-sm font-semibold text-white/80">
          Filters
          {active > 0 && (
            <span className="ml-2 rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
              {active}
            </span>
          )}
        </span>
        {active > 0 && (
          <Link href={base} className="text-xs font-medium text-accent hover:underline">
            Clear all
          </Link>
        )}
      </summary>

      <div className="space-y-2.5 border-t border-line px-4 py-3">
        <Row label="Sort">
          {SORTS.map(([v, l]) => (
            <Chip
              key={v}
              active={(current.sort ?? "updated") === v}
              to={href(base, current, { sort: v === "updated" ? undefined : v })}
            >
              {l}
            </Chip>
          ))}
        </Row>
        <Row label="Type">
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
        </Row>
        <Row label="Status">
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
        </Row>
        <Row label="Version">
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
        </Row>
        {showGenre && genres.length > 0 && (
          <Row label="Genre">
            <Chip active={!current.tag} to={href(base, current, { tag: undefined })}>
              All
            </Chip>
            {genres.map((g) => (
              <Chip
                key={g.slug}
                active={current.tag === g.slug}
                to={href(base, current, { tag: g.slug })}
              >
                {g.name}
              </Chip>
            ))}
          </Row>
        )}
      </div>
    </details>
  );
}
