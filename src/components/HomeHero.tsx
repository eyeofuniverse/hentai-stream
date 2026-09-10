"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { banner, bannerSet, cover, coverSet } from "@/lib/cloudinary";
import { SmartImg } from "@/components/SmartImg";

export type HeroSeries = {
  slug: string;
  title: string;
  synopsis: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  type: string;
  year: number | null;
  status: string;
  isCensored: boolean;
  externalScore: number | null;
  episodeCount: number;
  firstEpisode: number;
  tags: { slug: string; name: string }[];
};

const ROTATE_MS = 7500;

export function HomeHero({
  items,
  heroYear,
}: {
  items: HeroSeries[];
  heroYear: number | null;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (n: number) => setI(((n % items.length) + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (items.length < 2 || paused) return;
    timer.current = setTimeout(() => setI((v) => (v + 1) % items.length), ROTATE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [i, items.length, paused]);

  if (items.length === 0) return null;
  const s = items[Math.min(i, items.length - 1)];
  const useBanner = !!s.bannerUrl;
  const bg = useBanner ? banner(s.bannerUrl) : cover(s.coverUrl);
  const bgSet = useBanner ? bannerSet(s.bannerUrl) : coverSet(s.coverUrl);
  const poster = cover(s.coverUrl);

  return (
    <section
      className="relative isolate w-full overflow-hidden border-b border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="relative min-h-[520px] w-full sm:h-[64vw] sm:max-h-[620px] sm:min-h-[460px]">
        {/* backdrop */}
        <div key={s.slug} className="absolute inset-0 animate-fadein overflow-hidden">
          <div className={useBanner ? "absolute inset-0" : "absolute -inset-8 blur-2xl"}>
            <SmartImg
              src={bg}
              seed={s.slug}
              srcSet={bgSet ?? undefined}
              sizes="100vw"
              width={1280}
              height={720}
              eager={i === 0}
              className="h-full w-full animate-slow-zoom object-cover object-top"
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent lg:via-bg/30" />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-content items-end gap-10 px-4 pb-10 sm:pb-12 lg:px-8">
            {/* poster */}
            {poster && (
              <div className="hidden w-40 shrink-0 overflow-hidden rounded-2xl shadow-card ring-1 ring-white/10 md:block lg:w-48">
                <SmartImg
                  key={s.slug}
                  src={poster}
                  seed={s.slug}
                  srcSet={coverSet(s.coverUrl) ?? undefined}
                  sizes="192px"
                  alt={s.title}
                  width={300}
                  height={450}
                  className="aspect-[2/3] w-full animate-fadein object-cover"
                />
              </div>
            )}

            {/* copy */}
            <div key={s.slug} className="min-w-0 max-w-2xl animate-rise">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-accent">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  {heroYear ? `Fresh ${heroYear} drop` : "Featured"}
                </span>
              </div>

              <h1 className="font-display text-3xl font-extrabold leading-[1.03] tracking-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
                {s.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-white/80">
                {s.externalScore != null && (
                  <span className="flex items-center gap-1 text-warn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3 6.9 7.6.7-5.7 5 1.7 7.4L12 18l-6.6 4 1.7-7.4-5.7-5 7.6-.7z" />
                    </svg>
                    {s.externalScore.toFixed(1)}
                  </span>
                )}
                <span className="rounded bg-accent px-1.5 py-0.5 text-white">{s.type}</span>
                {s.year && <span>{s.year}</span>}
                {s.episodeCount > 0 && (
                  <span>
                    {s.episodeCount} episode{s.episodeCount === 1 ? "" : "s"}
                  </span>
                )}
                <span className={s.isCensored ? "text-white/55" : "text-good"}>
                  {s.isCensored ? "Censored" : "Uncensored"}
                </span>
              </div>

              {s.synopsis && (
                <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/65 sm:line-clamp-3 sm:text-[15px]">
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

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/hentai/${s.slug}/${s.firstEpisode}`}
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

            {/* slide rail (desktop) */}
            {items.length > 1 && (
              <div className="ml-auto hidden w-60 shrink-0 flex-col gap-1.5 xl:flex">
                {items.map((it, idx) => (
                  <button
                    key={it.slug}
                    onClick={() => setI(idx)}
                    className={`flex items-center gap-3 rounded-xl border p-1.5 text-left transition ${
                      idx === i
                        ? "border-accent/50 bg-white/10"
                        : "border-transparent opacity-55 hover:opacity-100"
                    }`}
                  >
                    <span className="block h-12 w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
                      <SmartImg
                        src={cover(it.coverUrl)}
                        seed={it.slug}
                        alt=""
                        width={80}
                        height={120}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white/90">
                        {it.title}
                      </span>
                      <span className="text-[10px] text-white/45">
                        {[it.type, it.year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* progress dots (mobile / tablet) */}
        {items.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5 xl:hidden">
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

        {/* prev / next (desktop) */}
        {items.length > 1 && (
          <>
            <button
              onClick={() => go(i - 1)}
              aria-label="Previous"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 p-2 text-white/70 backdrop-blur-sm transition hover:bg-black/70 hover:text-white lg:grid xl:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => go(i + 1)}
              aria-label="Next"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 p-2 text-white/70 backdrop-blur-sm transition hover:bg-black/70 hover:text-white lg:grid xl:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
