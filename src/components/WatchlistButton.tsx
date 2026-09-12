"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Status =
  | "WATCHING"
  | "COMPLETED"
  | "PLAN_TO_WATCH"
  | "ON_HOLD"
  | "DROPPED"
  | null;

const OPTIONS: { value: Exclude<Status, null>; label: string }[] = [
  { value: "WATCHING", label: "Watching" },
  { value: "PLAN_TO_WATCH", label: "Plan to watch" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "DROPPED", label: "Dropped" },
];
const LABEL: Record<string, string> = Object.fromEntries(
  OPTIONS.map((o) => [o.value, o.label]),
);

export function WatchlistButton({
  seriesId,
  initial,
  signedIn,
  size = "md",
}: {
  seriesId: string;
  initial: Status;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setStatus(initial), [initial]);
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  async function set(next: Status | "remove") {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    setOpen(false);
    const prev = status;
    setStatus(next === "remove" ? null : next);
    try {
      const r = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, status: next === "remove" ? "remove" : next }),
      });
      if (!r.ok) setStatus(prev);
      else router.refresh();
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!signedIn) {
            router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
            return;
          }
          setOpen((o) => !o);
        }}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-60 ${pad} ${
          status
            ? "border border-accent/40 bg-accent/15 text-accent"
            : "border border-line bg-surface text-white/75 hover:border-accent/40 hover:text-white"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={status ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {status ? LABEL[status] : "Add to watchlist"}
        {status && <span className="text-accent/50">▾</span>}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => set(o.value)}
              className={`block w-full px-3.5 py-2 text-left text-sm transition ${
                status === o.value
                  ? "bg-accent/15 text-accent"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          {status && (
            <button
              onClick={() => set("remove")}
              className="block w-full border-t border-line px-3.5 py-2 text-left text-sm text-white/50 hover:bg-white/5 hover:text-white"
            >
              Remove from watchlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}
