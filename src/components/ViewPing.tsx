"use client";

import { useEffect } from "react";
import { isAutomated } from "@/lib/isAutomated";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function ViewPing({
  episodeId,
  seriesSlug,
  episodeNumber,
}: {
  episodeId: string;
  seriesSlug?: string;
  episodeNumber?: number;
}) {
  useEffect(() => {
    if (isAutomated()) return;
    const key = `v_${episodeId}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* ignore */
    }
    const body = JSON.stringify({ episodeId });
    navigator.sendBeacon?.("/api/view", new Blob([body], { type: "application/json" }));

    // GA4 custom event, pushed straight onto the dataLayer queue rather than
    // through @next/third-parties' sendGAEvent — that helper only works once
    // its own <GoogleAnalytics> component has mounted (it gates on internal
    // module state Analytics.tsx no longer sets, now that gtag loads via a
    // plain lazyOnload <Script> for a lighter main-thread cost). Pushing
    // directly is also the standard gtag.js queue pattern: safe to call
    // before gtag.js has actually loaded — it replays whatever's already in
    // dataLayer once it initializes.
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(["event", "episode_view", { series_slug: seriesSlug, episode_number: episodeNumber }]);
    } catch {
      /* ignore */
    }
  }, [episodeId, seriesSlug, episodeNumber]);

  return null;
}
