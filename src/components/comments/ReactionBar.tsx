"use client";

import { useEffect, useRef, useState } from "react";
import { PICKER } from "./emoji";

export type Reaction = { emoji: string; count: number; mine: boolean };

export function ReactionBar({
  commentId,
  reactions,
  signedIn,
  onNeedAuth,
}: {
  commentId: string;
  reactions: Reaction[];
  signedIn: boolean;
  onNeedAuth: () => void;
}) {
  const [list, setList] = useState<Reaction[]>(reactions);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setList(reactions), [reactions]);
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  async function toggle(emoji: string) {
    if (!signedIn) return onNeedAuth();
    if (busy) return;
    setBusy(true);
    setOpen(false);

    // optimistic
    setList((prev) => {
      const cur = prev.find((r) => r.emoji === emoji);
      if (cur) {
        const next = cur.mine ? cur.count - 1 : cur.count + 1;
        const others = prev.filter((r) => r.emoji !== emoji);
        return next <= 0
          ? others
          : [...others, { emoji, count: next, mine: !cur.mine }].sort(
              (a, b) => b.count - a.count,
            );
      }
      return [...prev, { emoji, count: 1, mine: true }];
    });

    try {
      const r = await fetch(`/api/comments/${commentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (r.ok) {
        const d = (await r.json()) as { emoji: string; count: number; mine: boolean };
        setList((prev) => {
          const others = prev.filter((x) => x.emoji !== d.emoji);
          return d.count <= 0
            ? others
            : [...others, d].sort((a, b) => b.count - a.count);
        });
      } else {
        setList(reactions); // revert
      }
    } catch {
      setList(reactions);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative mt-1.5 flex flex-wrap items-center gap-1">
      {list.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggle(r.emoji)}
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
            r.mine
              ? "border-accent/50 bg-accent/15 text-white"
              : "border-line bg-surface text-white/60 hover:text-white"
          }`}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}

      <button
        onClick={() => (signedIn ? setOpen((o) => !o) : onNeedAuth())}
        className="grid h-6 w-6 place-items-center rounded-full border border-line text-white/50 transition hover:border-accent/40 hover:text-white"
        aria-label="Add a reaction"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-30 w-64 rounded-xl border border-line bg-surface p-2 shadow-card">
          <div className="grid grid-cols-8 gap-0.5">
            {PICKER.map((e) => (
              <button
                key={e}
                onClick={() => toggle(e)}
                className="grid h-7 place-items-center rounded-md text-lg transition hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
