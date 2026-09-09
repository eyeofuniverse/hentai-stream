"use client";

import { useEffect, useState } from "react";

const KEY = "hs_age_ok";

export function AgeGate() {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md">
      <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 font-display text-lg font-extrabold text-white shadow-glow">
          L
        </div>
        <h1 className="font-display text-xl font-extrabold">
          Lust<span className="text-accent">Hentai</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          This site contains sexually explicit animated material. By entering you
          confirm you are at least{" "}
          <strong className="text-white">18 years old</strong> (or the age of
          majority where you live) and that viewing this content is legal in your
          location.
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
            className="rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            I am 18 or older — Enter
          </button>
          <a
            href="https://www.google.com"
            className="rounded-xl border border-line py-3 text-sm text-white/55 transition hover:text-white"
          >
            Leave
          </a>
        </div>
      </div>
    </div>
  );
}
