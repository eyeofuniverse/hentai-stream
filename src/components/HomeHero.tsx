"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { banner, cover } from "@/lib/cloudinary";
import { gradientFor } from "@/lib/gradient";

export type HeroSeries = {
  slug: string;
  title: string;
  synopsis: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  type: string;
  year: number | null;
  status: string;
  tags: { slug: string; name: string }[];
  episodes: { number: number }[];
};

const ROTATE_MS = 8000;

export function HomeHero({ items }: { items: HeroSeries[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const s = items[i];
  const bg = banner(s.bannerUrl) ?? cover(s.coverUrl);
  const poster = cover(s.coverUrl);
  const firstEp = s.episodes[0]?.number ?? 1;

  return (
    <section className="relative isolate w-full overflow-hidden">
      <div className="relative h-[78vw] max-h-[600px] min-h-[420px] w-full">
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.slug}
            src={bg}
            alt=""
            className="absolute inset-0 h-full w-full animate-slow-zoom object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: gradientFor(s.slug) }} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-content items-end gap-8 px-4 pb-10 sm:pb-14 lg:px-8">
            {poster && (
              <div className="hidden w-44 shrink-0 overflow-hidden rounded-xl shadow-card ring-1 ring-white/10 lg:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster} alt={s.title} className="aspect-[2/3] w-full object-cover" />
              </div>
            )}

            <div className="min-w-0 max-w-2xl animate-rise">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-md bg-accent px-2 py-0.5 text-white">
                  {s.type}
                </span>
                {s.year && <span className="text-white/70">{s.year}</span>}
                <span className="text-white/50">·</span>
                <span className="text-white/70">
                  {s.status[0] + s.status.slice(1).toLowerCase()}
                </span>
              </div>

              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl">
                {s.title}
              </h1>

              {s.synopsis && (
                <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/70 sm:line-clamp-3 sm:text-[15px]">
                  {s.synopsis}
                </p>
              )}

              <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex">
                {s.tags.slice(0, 4).map((t) => (
                  <Link
                    key={t.slug}
                    href={`/tag/${t.slug}`}
                    className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80 backdrop-blur-sm transition hover:bg-white/20"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/hentai/${s.slug}/${firstEp}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch now
                </Link>
                <Link
                  href={`/hentai/${s.slug}`}
                  className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/10"
                >
                  Details
                </Link>
              </div>
            </div>
          </div>
        </div>

        {items.length > 1 && (
          <div className="absolute bottom-5 right-4 flex gap-1.5 lg:right-8">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-accent" : "w-1.5 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
