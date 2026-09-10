"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  slug: string;
  seriesTitle: string;
  number: number;
  title: string | null;
  thumb: string | null;
};

/** Per-viewer "keep watching" rail. Injected into the cached homepage; fetches
 *  after load and renders nothing for signed-out visitors / empty history. */
export function ContinueWatching() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/continue")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-8 px-4 lg:px-0">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight sm:text-xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
        Keep watching
      </h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        {items.map((it) => (
          <Link
            key={`${it.slug}-${it.number}`}
            href={`/hentai/${it.slug}/${it.number}`}
            className="group w-[180px] shrink-0 snap-start sm:w-[220px]"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5">
              {it.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.thumb}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover:opacity-100">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/90 text-white">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                EP {it.number}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-white/85 transition group-hover:text-accent">
              {it.seriesTitle}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
