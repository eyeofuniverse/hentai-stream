"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SeriesSug = {
  slug: string;
  title: string;
  cover: string | null;
  year: number | null;
  type: string;
  episodes: number;
};
type TagSug = { slug: string; name: string; count: number };
type Sug = { series: SeriesSug[]; tags: TagSug[] };

const EMPTY: Sug = { series: [], tags: [] };

export function SearchBar({ initial = "", big = false }: { initial?: string; big?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [sug, setSug] = useState<Sug>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1); // -1 = input, 0..n-1 = series rows, n = "all results"
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const term = q.trim();
  const rowCount = sug.series.length + (term.length >= 2 ? 1 : 0); // +1 = "see all"

  // debounced fetch
  useEffect(() => {
    if (term.length < 2) {
      setSug(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as Sug;
        if (!cancelled) setSug(data);
      } catch {
        /* aborted or offline */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  // close on outside click / Esc
  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  // "/" focuses the (first) search bar
  useEffect(() => {
    if (big) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  function goSearch(text: string) {
    const v = text.trim();
    if (v.length < 2) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(v)}`);
  }

  function track(payload: Record<string, string>) {
    try {
      navigator.sendBeacon?.(
        "/api/search/track",
        new Blob([JSON.stringify({ q: term, ...payload })], { type: "application/json" }),
      );
    } catch {
      /* ignore */
    }
  }

  function pickSeries(s: SeriesSug) {
    setOpen(false);
    track({ slug: s.slug });
    router.push(`/hentai/${s.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < sug.series.length) pickSeries(sug.series[active]);
      else goSearch(q);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showPanel = open && term.length >= 2;

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
        }}
        className={`group flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface/70 transition-colors focus-within:border-accent/60 focus-within:bg-surface ${
          big ? "px-4 py-3 text-base" : "px-3.5 py-2"
        }`}
      >
        <svg
          width={big ? 18 : 16}
          height={big ? 18 : 16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-white/35 transition-colors group-focus-within:text-accent"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={big ? "Search series, genres…" : "Search titles…"}
          aria-label="Search"
          autoComplete="off"
          className="w-full bg-transparent text-sm outline-none focus:outline-none focus-visible:outline-none placeholder:text-white/35"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              setSug(EMPTY);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-white/30 hover:text-white"
          >
            ✕
          </button>
        )}
        {!q && !big && (
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[10px] font-medium text-white/30 sm:block">
            /
          </kbd>
        )}
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {loading && sug.series.length === 0 && sug.tags.length === 0 ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-10 shrink-0 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : sug.series.length === 0 && sug.tags.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-white/45">
              No matches for “{term}”.
              <button
                onClick={() => goSearch(q)}
                className="mt-1 block w-full text-xs text-accent hover:underline"
              >
                Search everything anyway →
              </button>
            </div>
          ) : (
            <>
              {sug.series.length > 0 && (
                <ul className="max-h-[60vh] overflow-y-auto p-1.5">
                  {sug.series.map((s, i) => (
                    <li key={s.slug}>
                      <button
                        type="button"
                        onClick={() => pickSeries(s)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                          active === i ? "bg-white/8" : "hover:bg-white/5"
                        }`}
                      >
                        <span className="block h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-2">
                          {s.cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.cover}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                              }}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white/90">
                            {s.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-white/40">
                            {[s.type, s.year, s.episodes > 0 && `${s.episodes} ep`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sug.tags.length > 0 && (
                <div className="border-t border-line px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Genres
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sug.tags.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/tag/${t.slug}`}
                        onClick={() => {
                          setOpen(false);
                          track({ tagSlug: t.slug });
                        }}
                        className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/75 transition hover:bg-white/15 hover:text-white"
                      >
                        {t.name}
                        <span className="ml-1 text-white/30">{t.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => goSearch(q)}
                onMouseEnter={() => setActive(sug.series.length)}
                className={`block w-full border-t border-line px-4 py-2.5 text-left text-xs font-medium text-accent transition ${
                  active === sug.series.length ? "bg-white/5" : "hover:bg-white/5"
                }`}
              >
                See all results for “{term}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
