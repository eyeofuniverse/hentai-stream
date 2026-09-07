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

export function HomeHero({ items }: { items: HeroSeries[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const s = items[i];
  const bg = banner(s.bannerUrl) ?? cover(s.coverUrl);
  const firstEp = s.episodes[0]?.number ?? 1;

  return (
    <div className="relative -mt-4 mb-2 h-[62vw] max-h-[440px] min-h-[300px] w-full overflow-hidden sm:rounded-b-2xl">
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.slug}
          src={bg}
          alt=""
          className="absolute inset-0 h-full w-full animate-[fadein_.6s_ease] object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: gradientFor(s.slug) }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/30 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-6 sm:pb-8">
        <div className="max-w-xl">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded bg-accent px-1.5 py-0.5">{s.type}</span>
            {s.year && <span className="text-white/60">{s.year}</span>}
            <span className="text-white/60">
              {s.status[0] + s.status.slice(1).toLowerCase()}
            </span>
          </div>
          <h1 className="text-2xl font-black leading-tight drop-shadow sm:text-4xl">
            {s.title}
          </h1>
          {s.synopsis && (
            <p className="mt-2 line-clamp-2 text-sm text-white/75 sm:line-clamp-3">
              {s.synopsis}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.tags.slice(0, 4).map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80 backdrop-blur-sm hover:bg-white/20"
              >
                {t.name}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex gap-2.5">
            <Link
              href={`/hentai/${s.slug}/${firstEp}`}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold hover:brightness-110"
            >
              ▶ Watch now
            </Link>
            <Link
              href={`/hentai/${s.slug}`}
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm hover:bg-white/20"
            >
              Details
            </Link>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-5 bg-accent" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
