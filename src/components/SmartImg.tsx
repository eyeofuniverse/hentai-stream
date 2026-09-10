"use client";

import { useEffect, useRef, useState } from "react";
import { gradientFor } from "@/lib/gradient";

/**
 * <img> that never shows a broken-image icon. Tries `src`, then `fallback`, then
 * paints a deterministic gradient (from `seed`).
 *
 * It must render EXACTLY what the server rendered until React has hydrated —
 * otherwise a slow connection (image 404s / errors before the JS loads) makes
 * the element swap mid-hydration and React bails out with #418. So `onError`
 * only takes effect once `hydrated` is true.
 */
export function SmartImg({
  src,
  fallback,
  seed,
  alt = "",
  srcSet,
  sizes,
  width,
  height,
  eager,
  className = "",
}: {
  src: string | null | undefined;
  fallback?: string | null;
  seed: string;
  alt?: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  /** LCP image — load eagerly with high fetch priority */
  eager?: boolean;
  className?: string;
}) {
  const chain = [src, fallback].filter((x): x is string => !!x);
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  // restart the fallback chain when the parent swaps the source set
  const chainKey = chain.join("|");
  const prevKey = useRef(chainKey);
  if (prevKey.current !== chainKey) {
    prevKey.current = chainKey;
    if (step !== 0) setStep(0);
  }

  // pre-hydration we always show chain[0] (or the gradient if the chain is
  // empty) — same as the server; errors are applied only after hydration
  const active = hydrated ? step : 0;

  if (chain.length === 0 || active >= chain.length) {
    return (
      <div
        className={className}
        style={{ backgroundImage: gradientFor(seed) }}
        aria-label={alt || undefined}
        role={alt ? "img" : undefined}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chain[active]}
      srcSet={active === 0 && srcSet ? srcSet : undefined}
      sizes={active === 0 && srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      onError={() => setStep((s) => s + 1)}
      suppressHydrationWarning
      className={className}
    />
  );
}
