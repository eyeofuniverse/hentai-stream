"use client";

import { useEffect, useRef } from "react";
import { useAdblock } from "@/components/ads/AdblockProvider";
import { rewriteForAdblock } from "@/lib/adblock-rewrite";

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
  const { detected, domain } = useAdblock();

  useEffect(() => {
    if (!ref.current || !code) return;
    // once adblock is detected mid-session, re-inject the rewritten version
    // even though `code` itself hasn't changed
    const effective = detected && domain ? rewriteForAdblock(code, domain) : code;
    if (injected.current === effective) return;
    injected.current = effective;

    ref.current.innerHTML = effective;
    ref.current.querySelectorAll("script").forEach((old) => {
      const next = document.createElement("script");
      Array.from(old.attributes).forEach((a) => next.setAttribute(a.name, a.value));
      next.textContent = old.textContent;
      old.parentNode?.replaceChild(next, old);
    });
  }, [code, detected, domain]);

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
