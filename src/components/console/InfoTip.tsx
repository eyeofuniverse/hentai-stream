"use client";

import { useEffect, useRef, useState } from "react";

/** A small "i" that reveals a one-line explanation on hover (desktop) or tap
 *  (touch / keyboard). Safe to place inside a <label> — it won't trigger the
 *  field. Auto-flips to stay on screen. */
export function InfoTip({ text }: { text: string }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<"left" | "right" | "center">("left");
  const ref = useRef<HTMLSpanElement>(null);
  const open = pinned || hover;

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = Math.min(240, window.innerWidth - 32);
    if (r.left + w > window.innerWidth - 12) setPos("right");
    else if (r.left - w / 2 < 12) setPos("left");
    else setPos("center");
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinned(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  const posCls =
    pos === "right"
      ? "right-0"
      : pos === "left"
        ? "left-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span ref={ref} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="grid h-[15px] w-[15px] place-items-center rounded-full border border-white/25 text-[9px] font-bold leading-none text-white/45 transition-colors hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-[22px] z-50 w-[min(15rem,calc(100vw-2rem))] rounded-lg border border-white/15 bg-surface-2 px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-white/80 shadow-2xl ${posCls}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
