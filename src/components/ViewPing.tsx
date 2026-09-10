"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

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

    // GA4 custom event — no-ops when GA isn't configured
    try {
      if (typeof window !== "undefined" && "dataLayer" in window) {
        sendGAEvent("event", "episode_view", {
          series_slug: seriesSlug,
          episode_number: episodeNumber,
        });
      }
    } catch {
      /* ignore */
    }
  }, [episodeId, seriesSlug, episodeNumber]);

  return null;
}
