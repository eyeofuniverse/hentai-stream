"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SearchBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) {
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          ref.current?.blur();
        }
      }}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface/70 px-3.5 py-2 transition-colors focus-within:border-accent/60 focus-within:bg-surface"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-white/35 transition-colors group-focus-within:text-accent"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search titles…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
      />
      <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[10px] font-medium text-white/30 sm:block">
        /
      </kbd>
    </form>
  );
}
