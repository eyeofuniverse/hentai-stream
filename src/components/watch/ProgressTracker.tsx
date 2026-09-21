"use client";

import { useEffect } from "react";

/** Records watch progress for the signed-in viewer: a "started" ping on mount,
 *  and "completed" when the player fires `lh:episode-ended`. No-ops server-side
 *  for signed-out visitors. */
export function ProgressTracker({ episodeId }: { episodeId: string }) {
  useEffect(() => {
    const send = (completed: boolean) => {
      const body = JSON.stringify({ episodeId, completed });
      // fetch(keepalive) first, not sendBeacon: this endpoint requires the
      // viewer's session cookie to attribute the row, and sendBeacon was
      // confirmed (live) to sometimes fire without it — the browser reports
      // success, the server sees an anonymous request, and the row silently
      // never gets written. keepalive fetch gives the same "survives page
      // unload" guarantee while behaving like a normal credentialed request.
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        navigator.sendBeacon?.("/api/progress", new Blob([body], { type: "application/json" }));
      });
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
