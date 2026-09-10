"use client";

import { useEffect, useState } from "react";
import { AdUnit } from "@/components/ads/AdUnit";
import { AffiliateAd } from "@/components/ads/AffiliateAd";
import type { ActiveAd } from "@/lib/ad-queries";

/* dedupe simultaneous fetches for the same slot+device; 5-min client TTL */
const TTL = 5 * 60 * 1000;
const cache = new Map<string, { p: Promise<ActiveAd | null>; ts: number }>();

function device(): "mobile" | "tablet" | "desktop" {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function load(slot: string, dev: string): Promise<ActiveAd | null> {
  const key = `${slot}:${dev}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.p;
  const p = fetch(`/api/ads/active?slot=${encodeURIComponent(slot)}&device=${dev}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  cache.set(key, { p, ts: Date.now() });
  return p;
}

/**
 * A named ad position. Fetches the active ad for this slot + the viewer's
 * device and renders it, or nothing. Managed from Admin → Ads.
 */
export function AdSlot({
  slotKey,
  className = "",
  label = true,
}: {
  slotKey: string;
  className?: string;
  label?: boolean;
}) {
  const [ad, setAd] = useState<ActiveAd | null | undefined>(undefined);

  useEffect(() => {
    load(slotKey, device()).then(setAd);
  }, [slotKey]);

  if (ad == null) return null; // undefined = loading, null = empty

  return (
    <div className={`mx-auto w-full max-w-3xl ${className}`} aria-label="Advertisement">
      {label && (
        <div className="mb-2 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">
            Advertisement
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className="overflow-hidden">
        {ad.type === "network" ? (
          <AdUnit code={ad.networkCode ?? ""} />
        ) : (
          <AffiliateAd
            imageUrl={ad.imageUrl ?? ""}
            linkUrl={ad.linkUrl ?? "#"}
            altText={ad.altText ?? ""}
            title={ad.adTitle}
            description={ad.adDescription}
          />
        )}
      </div>
    </div>
  );
}
