"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RateWidget({
  seriesId,
  initial,
  signedIn,
  avg: avg0,
  count: count0,
}: {
  seriesId: string;
  initial: number | null;
  signedIn: boolean;
  avg: number;
  count: number;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<number | null>(initial);
  const [avg, setAvg] = useState(avg0);
  const [count, setCount] = useState(count0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  async function rate(v: number) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const next = mine === v ? 0 : v; // click your current score again to clear
    setBusy(true);
    const prev = mine;
    setMine(next || null);
    try {
      const r = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, value: next }),
      });
      if (!r.ok) {
        setMine(prev);
      } else {
        const d = await r.json().catch(() => null);
        if (d && typeof d.avg === "number") {
          setAvg(d.avg);
          setCount(d.count);
        }
        router.refresh();
      }
    } catch {
      setMine(prev);
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || mine || 0;

  return (
    <div className="rounded-2xl border border-line bg-surface/40 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
          {mine ? "Your rating" : "Rate this"}
        </p>
        {count > 0 && (
          <p className="text-xs text-white/45">
            <span className="font-bold text-warn">{avg.toFixed(1)}</span> · {count.toLocaleString()} vote{count === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <div
        className="mt-2 flex gap-0.5"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Rate 1 to 10"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            aria-label={`${n} / 10`}
            className="p-0.5 disabled:opacity-60"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              className={n <= shown ? "text-warn" : "text-white/15"}
              fill="currentColor"
            >
              <path d="M12 2l3 6.9 7.6.7-5.7 5 1.7 7.4L12 18l-6.6 4 1.7-7.4-5.7-5 7.6-.7z" />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-1.5 h-4 text-xs text-white/50">
        {shown ? `${shown} / 10` : mine ? "" : "Click a star"}
      </p>
    </div>
  );
}
