"use client";

import { useState } from "react";
import { SeriesCard } from "@/components/SeriesCard";

type S = Parameters<typeof SeriesCard>[0]["series"];

export function CalendarTabs({ popular, fresh }: { popular: S[]; fresh: S[] }) {
  const [tab, setTab] = useState<"popular" | "fresh">("popular");
  const list = tab === "popular" ? popular : fresh;
  if (popular.length === 0 && fresh.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex gap-2">
        {(
          [
            ["popular", "Popular"],
            ["fresh", "Just added"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === v
                ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
                : "bg-surface text-white/60 hover:text-white"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {list.map((s) => (
          <SeriesCard key={s.slug} series={s} />
        ))}
      </div>
    </section>
  );
}
