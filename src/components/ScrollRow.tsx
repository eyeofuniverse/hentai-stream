"use client";

import Link from "next/link";
import { useRef } from "react";

export function ScrollRow({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="group/row mt-10">
      <div className="mb-4 flex items-end justify-between gap-4 px-4 lg:px-0">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight sm:text-xl">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {href && (
            <Link
              href={href}
              className="text-xs font-medium text-white/50 transition-colors hover:text-accent"
            >
              View all →
            </Link>
          )}
          <div className="hidden gap-1 sm:flex">
            <button
              onClick={() => scroll(-1)}
              aria-label="Scroll left"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-white/60 transition hover:border-accent/40 hover:text-white"
            >
              ‹
            </button>
            <button
              onClick={() => scroll(1)}
              aria-label="Scroll right"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-white/60 transition hover:border-accent/40 hover:text-white"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div
        ref={ref}
        className="no-scrollbar flex snap-x gap-3.5 overflow-x-auto scroll-smooth px-4 pb-1 lg:px-0"
      >
        {children}
      </div>
    </section>
  );
}
