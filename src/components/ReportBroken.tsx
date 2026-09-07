"use client";

import { useState } from "react";

export function ReportBroken({ episodeId }: { episodeId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  if (state === "done") {
    return <span className="text-xs text-white/40">Thanks — flagged for review.</span>;
  }

  return (
    <button
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: "episode",
            targetId: episodeId,
            reason: "BROKEN_LINK",
          }),
        });
        setState("done");
      }}
      className="text-xs text-white/50 underline hover:text-white disabled:opacity-50"
    >
      Report broken video
    </button>
  );
}
