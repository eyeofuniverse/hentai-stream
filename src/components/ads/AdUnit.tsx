"use client";

import { useEffect, useRef } from "react";

/** Injects a raw ad-network embed (HTML + <script>), re-executing scripts. */
export function AdUnit({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef("");

  useEffect(() => {
    if (!ref.current || !code || injected.current === code) return;
    injected.current = code;

    ref.current.innerHTML = code;
    ref.current.querySelectorAll("script").forEach((old) => {
      const next = document.createElement("script");
      Array.from(old.attributes).forEach((a) => next.setAttribute(a.name, a.value));
      next.textContent = old.textContent;
      old.parentNode?.replaceChild(next, old);
    });
    // no cleanup — removing scripts breaks the ad-network lifecycle
  }, [code]);

  if (!code) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%", overflow: "hidden" }}>
      <div ref={ref} style={{ maxWidth: "100%", overflow: "hidden" }} />
    </div>
  );
}
