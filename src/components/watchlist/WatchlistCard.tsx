"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cover } from "@/lib/cloudinary";
import { Poster, PlayGlyph } from "@/components/ui";

type Status =
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED";

const OPTIONS: { value: Status; label: string }[] = [
  { value: "WATCHING", label: "Watching" },
  { value: "PLAN_TO_WATCH", label: "Plan to watch" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "DROPPED", label: "Dropped" },
];
const SHORT: Record<Status, string> = {
  WATCHING: "Watching",
  PLAN_TO_WATCH: "Planned",
  COMPLETED: "Done",
  ON_HOLD: "On hold",
  DROPPED: "Dropped",
};

type Series = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  year?: number | null;
  type?: string | null;
  _count?: { episodes: number };
};

export function WatchlistCard({
  series,
  status,
}: {
  series: Series;
  status: Status;
}) {
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(status);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setSt(status), [status]);
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  async function change(next: Status | "remove") {
    setBusy(true);
    setOpen(false);
    try {
      const r = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: series.id, status: next }),
      });
      if (r.ok) {
        setSt(next === "remove" ? null : next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (st === null) return null; // removed — hide until refresh

  const eps = series._count?.episodes ?? 0;

  return (
    <div ref={ref} className="group relative">
      <Link href={`/hentai/${series.slug}`} className="block">
        <Poster src={cover(series.coverUrl)} coverId={series.coverUrl} title={series.title} seed={series.slug}>
          <PlayGlyph />
          {eps > 0 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
              {eps} EP
            </span>
          )}
        </Poster>
        <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 transition group-hover:text-accent">
          {series.title}
        </p>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        disabled={busy}
        className="absolute left-1.5 top-1.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm transition hover:bg-black/90 disabled:opacity-50"
      >
        {SHORT[st]} ▾
      </button>

      {open && (
        <div className="absolute left-1.5 top-8 z-20 w-40 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => change(o.value)}
              className={`block w-full px-3 py-1.5 text-left text-xs transition ${
                st === o.value
                  ? "bg-accent/15 text-accent"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => change("remove")}
            className="block w-full border-t border-line px-3 py-1.5 text-left text-xs text-white/40 hover:bg-white/5 hover:text-white"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
