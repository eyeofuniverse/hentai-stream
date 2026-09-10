"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Ep = { number: number; title: string | null };

/**
 * The "all episodes" list used in the watch-page rail and the mobile disclosure.
 * Scrolls the current episode into view on mount; filters when the list is long.
 */
export function EpisodeList({
  slug,
  episodes,
  current,
  className = "",
  maxHeight = "60vh",
}: {
  slug: string;
  episodes: Ep[];
  current: number;
  className?: string;
  maxHeight?: string;
}) {
  const [q, setQ] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    curRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return episodes;
    return episodes.filter(
      (e) =>
        String(e.number).includes(s) ||
        (e.title ?? "").toLowerCase().includes(s),
    );
  }, [q, episodes]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface/50 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-display text-sm font-bold">Episodes</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/45">
          {episodes.length}
        </span>
      </div>

      {episodes.length > 12 && (
        <div className="border-b border-line px-3 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="numeric"
            placeholder="Jump to episode…"
            className="w-full rounded-lg bg-black/30 px-3 py-1.5 text-sm text-white/80 outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-accent/40"
          />
        </div>
      )}

      <div
        ref={scrollRef}
        className="no-scrollbar overflow-y-auto p-2"
        style={{ maxHeight }}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-white/35">No match.</p>
        ) : (
          filtered.map((e) => {
            const isCur = e.number === current;
            return (
              <Link
                key={e.number}
                ref={isCur ? curRef : undefined}
                href={`/hentai/${slug}/${e.number}`}
                aria-current={isCur ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isCur
                    ? "bg-accent/15 text-white ring-1 ring-inset ring-accent/30"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`grid h-7 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums ${
                    isCur ? "bg-accent text-white" : "bg-surface-2 text-white/55"
                  }`}
                >
                  {e.number}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {e.title || `Episode ${e.number}`}
                </span>
                {isCur && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-accent">
                    Now
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
