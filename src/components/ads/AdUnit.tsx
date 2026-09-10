"use client";

import { useEffect, useRef } from "react";

/**
 * Injects a raw ad-network embed (HTML + <script>), re-executing scripts.
 * The wrapper is a hard containment box: `contain` + a stacking context turn
 * any `position: fixed` the ad tries into `position: absolute` relative to
 * here, and `overflow: hidden` clips anything that overshoots — so a
 * misbehaving creative can never cover the site chrome.
 */
export function AdUnit({
  code,
  maxHeight,
}: {
  code: string;
  maxHeight?: number;
}) {
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
  }, [code]);

  if (!code) return null;
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        isolation: "isolate",
        contain: "layout paint style",
        overflow: "hidden",
        maxWidth: "100%",
        ...(maxHeight ? { maxHeight } : {}),
        display: "flex",
        justifyContent: "center",
      }}
    />
  );
}
