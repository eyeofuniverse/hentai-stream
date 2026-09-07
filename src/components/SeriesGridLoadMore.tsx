"use client";

import { useState } from "react";
import { SeriesCard } from "@/components/SeriesCard";

type S = Parameters<typeof SeriesCard>[0]["series"];

/**
 * Renders page 1 (passed from the server-cached page) and loads further pages
 * client-side, so the landing page itself stays fully cacheable.
 */
export function SeriesGridLoadMore({
  initial,
  totalPages,
  query,
}: {
  initial: S[];
  totalPages: number;
  query: Record<string, string>;
}) {
  const [items, setItems] = useState<S[]>(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function more() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ ...query, page: String(page + 1) });
      const res = await fetch(`/api/browse?${qs}`);
      const data = await res.json();
      setItems((p) => [...p, ...(data.items ?? [])]);
      setPage((p) => p + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {items.map((s) => (
          <SeriesCard key={s.slug} series={s} />
        ))}
      </div>
      {page < totalPages && (
        <div className="mt-8 text-center">
          <button
            onClick={more}
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
