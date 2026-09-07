"use client";

import { useEffect } from "react";

export function ViewPing({ episodeId }: { episodeId: string }) {
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
  }, [episodeId]);

  return null;
}
