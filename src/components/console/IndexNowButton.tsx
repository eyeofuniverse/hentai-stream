"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { btnCls } from "@/components/console/ui";

type Result = {
  seriesCount: number;
  episodeCount: number;
  tagCount: number;
  studioCount: number;
  totalUrls: number;
  submitted: number;
  failed: number;
};

/** One-off bulk submit of the whole published catalogue to IndexNow (Bing,
 *  Yandex, Seznam, Naver...). New content doesn't need this button — it's
 *  submitted automatically the moment it goes live (see publishIfLive). This
 *  is for backfilling everything that published before that existed. */
export function IndexNowButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (
      !window.confirm(
        "Submit the entire published catalogue to IndexNow (Bing and other IndexNow-compatible search engines)? This runs once — new content is already submitted automatically as it goes live.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/console/indexnow", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Submit failed");
      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={submit} disabled={busy} className={btnCls("secondary", "md")}>
        <Globe size={15} className="text-accent" />
        {busy ? "Submitting…" : "Submit all to IndexNow"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-white/45">
          Submitted <span className="font-semibold text-emerald-300">{result.submitted}</span> of{" "}
          {result.totalUrls} URLs ({result.seriesCount} series, {result.episodeCount} episodes,{" "}
          {result.tagCount} tags, {result.studioCount} studios)
          {result.failed > 0 && (
            <span className="text-amber-300"> — {result.failed} failed, try again later</span>
          )}
          .
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
