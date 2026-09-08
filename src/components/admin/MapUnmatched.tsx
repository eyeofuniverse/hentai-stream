"use client";

import { useState, useTransition } from "react";
import { mapUnmatched, searchSeriesForPicker } from "@/lib/scraper-actions";
import { inputCls, btnCls } from "./ui";

type Hit = { id: string; title: string; year: number | null; _count: { episodes: number } };

export function MapUnmatched({ unmatchedId, defaultQuery }: { unmatchedId: string; defaultQuery: string }) {
  const [q, setQ] = useState(defaultQuery);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startSearch] = useTransition();
  const [mapping, startMap] = useTransition();
  const [done, setDone] = useState(false);

  function run(term: string) {
    setQ(term);
    if (term.trim().length < 2) return setHits([]);
    startSearch(async () => setHits((await searchSeriesForPicker(term)) as Hit[]));
  }

  if (done) return <p className="text-xs text-emerald-300">✓ mapped — next crawl will ingest it</p>;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => run(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="find the matching series…"
          className={`${inputCls} text-xs`}
        />
      </div>

      {open && (hits.length > 0 || searching) && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/15 bg-surface-2 text-xs shadow-xl">
          {searching && <li className="px-3 py-2 text-white/40">searching…</li>}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                disabled={mapping}
                onClick={() =>
                  startMap(async () => {
                    await mapUnmatched(unmatchedId, h.id);
                    setDone(true);
                  })
                }
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="shrink-0 text-white/35">
                  {h.year ?? "—"} · {h._count.episodes} ep
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
