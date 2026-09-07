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
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mt-9">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-0">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">
          <span className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded bg-accent" />
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {href && (
            <Link href={href} className="mr-1 text-xs text-white/40 hover:text-white">
              View all →
            </Link>
          )}
          <button
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="hidden h-7 w-7 place-items-center rounded-full bg-surface text-white/60 hover:bg-surface-2 hover:text-white sm:grid"
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="hidden h-7 w-7 place-items-center rounded-full bg-surface text-white/60 hover:bg-surface-2 hover:text-white sm:grid"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:px-0"
      >
        {children}
      </div>
    </section>
  );
}
