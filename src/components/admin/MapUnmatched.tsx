"use client";

import { useState, useTransition } from "react";
import { mapUnmatched, searchSeriesForPicker } from "@/lib/scraper-actions";
import { inputCls } from "./ui";

type Hit = {
  id: string;
  title: string;
  year: number | null;
  _count: { episodes: number };
};

export type Suggestion = {
  id: string;
  title: string;
  year: number | null;
  eps: number;
  score: number; // 0..1 trigram similarity
};

export function MapUnmatched({
  unmatchedId,
  defaultQuery,
  suggestions = [],
}: {
  unmatchedId: string;
  defaultQuery: string;
  suggestions?: Suggestion[];
}) {
  const [q, setQ] = useState(defaultQuery);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startSearch] = useTransition();
  const [mapping, startMap] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  function run(term: string) {
    setQ(term);
    if (term.trim().length < 2) return setHits([]);
    startSearch(async () => setHits((await searchSeriesForPicker(term)) as Hit[]));
  }

  function pick(seriesId: string, title: string) {
    startMap(async () => {
      await mapUnmatched(unmatchedId, seriesId);
      setDone(title);
    });
  }

  if (done)
    return (
      <p className="text-xs text-emerald-300">
        ✓ mapped to <span className="font-semibold">{done}</span> — next crawl
        ingests the episodes
      </p>
    );

  return (
    <div className="space-y-1.5">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/30">
            Likely
          </span>
          {suggestions.map((sg) => (
            <button
              key={sg.id}
              disabled={mapping}
              onClick={() => pick(sg.id, sg.title)}
              title={`${Math.round(sg.score * 100)}% title match`}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <span className="max-w-[220px] truncate">{sg.title}</span>
              <span className="text-emerald-400/60">
                {sg.year ?? "—"} · {sg.eps} ep
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={q}
          onChange={(e) => run(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="…or search for the right series"
          className={`${inputCls} text-xs`}
        />

        {open && (hits.length > 0 || searching) && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/15 bg-surface-2 text-xs shadow-xl">
            {searching && <li className="px-3 py-2 text-white/40">searching…</li>}
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  disabled={mapping}
                  onClick={() => pick(h.id, h.title)}
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
    </div>
  );
}
