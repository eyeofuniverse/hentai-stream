"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SeriesCard } from "@/components/SeriesCard";

type S = Parameters<typeof SeriesCard>[0]["series"];
type Tag = { slug: string; name: string };

const TYPES = ["OVA", "ONA", "MOVIE", "SPECIAL", "SERIES"];
const STATUSES = ["ONGOING", "COMPLETED", "HIATUS"];
const SORTS = [
  ["updated", "Recently updated"],
  ["new", "Newest"],
  ["popular", "Most viewed"],
  ["rating", "Top rated"],
  ["az", "A–Z"],
] as const;

export function BrowseClient({
  initial,
  initialTotal,
  initialPages,
  tags,
}: {
  initial: S[];
  initialTotal: number;
  initialPages: number;
  tags: Tag[];
}) {
  const [f, setF] = useState<Record<string, string>>({ sort: "updated" });
  const [items, setItems] = useState<S[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [pages, setPages] = useState(initialPages);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  const load = useCallback(
    async (filters: Record<string, string>, pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ ...filters, page: String(pageNum) });
        const res = await fetch(`/api/browse?${qs}`);
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(pageNum);
        const url = new URLSearchParams(filters);
        window.history.replaceState(null, "", url.toString() ? `/browse?${url}` : "/browse");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load(f, 1, false);
  }, [f, load]);

  const set = (k: string, v?: string) =>
    setF((prev) => {
      const n = { ...prev };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });

  return (
    <>
      <div className="space-y-3 text-sm">
        <Row label="Sort">
          {SORTS.map(([v, l]) => (
            <Chip key={v} on={f.sort === v} onClick={() => set("sort", v)}>{l}</Chip>
          ))}
        </Row>
        <Row label="Type">
          <Chip on={!f.type} onClick={() => set("type")}>All</Chip>
          {TYPES.map((t) => (
            <Chip key={t} on={f.type === t.toLowerCase()} onClick={() => set("type", t.toLowerCase())}>
              {t}
            </Chip>
          ))}
        </Row>
        <Row label="Status">
          <Chip on={!f.status} onClick={() => set("status")}>All</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} on={f.status === s.toLowerCase()} onClick={() => set("status", s.toLowerCase())}>
              {s[0] + s.slice(1).toLowerCase()}
            </Chip>
          ))}
        </Row>
        <Row label="Tag">
          <Chip on={!f.tag} onClick={() => set("tag")}>All</Chip>
          {tags.map((t) => (
            <Chip key={t.slug} on={f.tag === t.slug} onClick={() => set("tag", t.slug)}>
              {t.name}
            </Chip>
          ))}
        </Row>
      </div>

      <p className="my-4 text-xs text-white/40">{total} series</p>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/40">Nothing matches those filters.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((s) => (
            <SeriesCard key={s.slug} series={s} />
          ))}
        </div>
      )}

      {page < pages && (
        <div className="mt-8 text-center">
          <button
            onClick={() => load(f, page + 1, true)}
            disabled={loading}
            className="rounded-full bg-surface px-6 py-2.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-xs font-semibold uppercase text-white/35">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${
        on ? "bg-accent font-semibold text-white" : "bg-surface text-white/70 hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
