"use client";

import { useEffect, useState } from "react";

type VastConfig = { tags: string[]; capMinutes: number; skipAfterSec: number };

/** Console → Ads settings for the custom VAST pre-roll (src/lib/vast.ts,
 *  src/components/ads/PreRollAd.tsx) — tags are tried in order as a
 *  waterfall until one resolves to a real ad. */
export function VastAdsSettings() {
  const [cfg, setCfg] = useState<VastConfig | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/console/ads/vast")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: VastConfig | null) => {
        if (!d) return;
        setCfg(d);
        setTagsText(d.tags.join("\n"));
      });
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    const tags = tagsText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const r = await fetch("/api/console/ads/vast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, capMinutes: cfg.capMinutes, skipAfterSec: cfg.skipAfterSec }),
    });
    setSaving(false);
    setMsg(r.ok ? "Saved." : "Save failed — try again.");
  }

  if (!cfg) return null;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface/50 p-4">
      <h3 className="font-display text-sm font-bold">Video pre-roll (VAST)</h3>
      <p className="mt-1 text-xs text-white/50">
        Our own player, not Bunny&apos;s — tags below are tried in order (a waterfall) until one
        returns a real ad. One tag URL per line.
      </p>

      <label className="mt-4 block text-xs font-medium text-white/60">VAST tag URLs</label>
      <textarea
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        rows={4}
        placeholder="https://s.magsrv.com/v1/vast.php?idz=..."
        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-white/85 outline-none focus:border-accent/50"
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-white/60">Show again after (minutes)</label>
          <input
            type="number"
            min={0}
            value={cfg.capMinutes}
            onChange={(e) => setCfg({ ...cfg, capMinutes: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none focus:border-accent/50"
          />
          <p className="mt-1 text-[11px] text-white/40">0 = show on every play</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60">Skip button appears after (seconds)</label>
          <input
            type="number"
            min={0}
            value={cfg.skipAfterSec}
            onChange={(e) => setCfg({ ...cfg, skipAfterSec: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none focus:border-accent/50"
          />
          <p className="mt-1 text-[11px] text-white/40">0 = use the ad&apos;s own skip offset</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-xs text-white/50">{msg}</span>}
      </div>
    </div>
  );
}
