"use client";

import { useRef, useState } from "react";
import { gradientFor } from "@/lib/gradient";

/**
 * <img> that never shows a broken-image icon. Tries `src`, then `fallback`, then
 * paints a deterministic gradient (from `seed`). Scraped thumbnail URLs rot, so
 * everything user-facing goes through this.
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

  // if the parent swaps `src` (e.g. a rotating hero) start the fallback chain
  // over — otherwise a previously-failed instance stays stuck on the gradient
  const key = chain.join("|");
  const prevKey = useRef(key);
  if (prevKey.current !== key) {
    prevKey.current = key;
    if (step !== 0) setStep(0);
  }

  if (step >= chain.length || chain.length === 0) {
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
      src={chain[step]}
      srcSet={step === 0 && srcSet ? srcSet : undefined}
      sizes={step === 0 && srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      onError={() => setStep((s) => s + 1)}
      // this <img> can fall through to a different src/element after a load
      // error — that's deliberate client behaviour, not a hydration bug
      suppressHydrationWarning
      className={className}
    />
  );
}
