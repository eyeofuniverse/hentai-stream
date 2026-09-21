"use client";

import { useEffect } from "react";
import { isAutomated } from "@/lib/isAutomated";
import { gaEvent } from "@/lib/ga";

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

    // Page-open event (not playback — that's episode_play, fired by
    // WatchPlayer when the viewer actually starts the video).
    gaEvent("episode_view", { series_slug: seriesSlug, episode_number: episodeNumber });
  }, [episodeId, seriesSlug, episodeNumber]);

  return null;
}
