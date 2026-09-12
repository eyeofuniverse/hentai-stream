"use client";

import { useState } from "react";

export function ReportBroken({ episodeId }: { episodeId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  if (state === "done") {
    return (
      <span className="text-xs text-white/50">Thanks — flagged for review.</span>
    );
  }

  return (
    <button
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        try {
          const r = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetType: "episode",
              targetId: episodeId,
              reason: "BROKEN_LINK",
            }),
          });
          setState(r.ok ? "done" : "idle");
        } catch {
          setState("idle");
        }
      }}
      className="inline-flex items-center gap-1.5 text-xs text-white/45 transition hover:text-accent disabled:opacity-50"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      Report broken video
    </button>
  );
}
