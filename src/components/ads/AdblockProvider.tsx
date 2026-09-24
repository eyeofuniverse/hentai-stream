"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type AdblockState = { detected: boolean; domain: string | null };

const Ctx = createContext<AdblockState>({ detected: false, domain: null });

/** { detected: false, domain: null } for the vast majority of visitors (no
 *  adblocker) — ad components should treat that as "render normally". Only
 *  once `detected` flips true is there anything to rewrite. */
export function useAdblock(): AdblockState {
  return useContext(Ctx);
}

/**
 * Detects whether the viewer's adblocker stripped our bait script
 * (public/ads.js — the exact `let bait_b3j4hu231 = true;` convention
 * ExoClick's own NeverBlock docs specify, plus a window flag of our own
 * since checking a bare non-window-scoped `let` from arbitrary later code
 * isn't practically doable outside the script that declared it) and, if so,
 * fetches the current rotated ad-serving domain so AdUnit/GlobalPopUnder
 * can route around the block. A blocked/slow bait script never delays real
 * content — this only ever flips ad-rendering into a fallback path, nothing
 * else on the page waits on it.
 */
export function AdblockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdblockState>({ detected: false, domain: null });
  const settled = useRef(false);

  useEffect(() => {
    const markBlocked = () => {
      if (settled.current) return;
      settled.current = true;
      fetch("/api/ads/domain")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { domain: string | null } | null) => {
          if (d?.domain) setState({ detected: true, domain: d.domain });
        })
        .catch(() => {});
    };
    const markClean = () => {
      settled.current = true;
    };

    const script = document.createElement("script");
    script.src = "/ads.js";
    script.onload = () => {
      // a blocker can let the request through (200) but swap in an empty
      // stub — only trust it once our own flag actually landed
      if ((window as unknown as Record<string, unknown>).__lhAdsBaitLoaded === true) markClean();
      else markBlocked();
    };
    script.onerror = markBlocked;
    document.head.appendChild(script);

    // some blockers hang the request instead of erroring outright
    const timer = setTimeout(markBlocked, 3000);

    return () => clearTimeout(timer);
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
