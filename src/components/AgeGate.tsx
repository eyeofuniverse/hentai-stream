"use client";

import { useEffect, useState } from "react";

const KEY = "hs_age_ok";

export function AgeGate() {
  // assume consent during SSR/first paint so content (and crawlers) aren't blocked
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-7 text-center">
        <div className="mx-auto mb-5 h-11 w-11 rounded-xl bg-accent" />
        <h1 className="text-xl font-bold">
          Lust<span className="text-accent">Hentai</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          This site contains sexually explicit animated material. By entering you
          confirm you are at least <strong className="text-white">18 years old</strong>{" "}
          (or the age of majority where you live) and that viewing this content is
          legal in your location.
        </p>
        <p className="mt-3 text-xs text-white/40">
          All content is animated — no real persons are depicted.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => {
              try {
                localStorage.setItem(KEY, "1");
              } catch {
                /* ignore */
              }
              setShow(false);
            }}
            className="rounded-full bg-accent py-3 text-sm font-semibold"
          >
            I am 18 or older — Enter
          </button>
          <a
            href="https://www.google.com"
            className="rounded-full border border-white/15 py-3 text-sm text-white/60"
          >
            Leave
          </a>
        </div>
      </div>
    </div>
  );
}
