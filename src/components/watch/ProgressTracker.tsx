"use client";

import { useEffect } from "react";

/** Records watch progress for the signed-in viewer: a "started" ping on mount,
 *  and "completed" when the player fires `lh:episode-ended`. No-ops server-side
 *  for signed-out visitors. */
export function ProgressTracker({ episodeId }: { episodeId: string }) {
  useEffect(() => {
    const send = (completed: boolean) => {
      const body = JSON.stringify({ episodeId, completed });
      navigator.sendBeacon?.(
        "/api/progress",
        new Blob([body], { type: "application/json" }),
      ) ||
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
    };

    const started = setTimeout(() => send(false), 4000); // 4s in = a real watch
    const onEnded = () => send(true);
    window.addEventListener("lh:episode-ended", onEnded);
    return () => {
      clearTimeout(started);
      window.removeEventListener("lh:episode-ended", onEnded);
    };
  }, [episodeId]);

  return null;
}
