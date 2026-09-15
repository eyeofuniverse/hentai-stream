"use client";

import { useEffect, useState } from "react";

type Settings = {
  autoEnabled: boolean;
  autoPlatforms: string[];
  defaultTags: string[];
  bluesky: { configured: boolean };
  tumblr: { configured: boolean; connected: boolean };
};

const PLATFORMS = [
  { key: "bluesky", label: "Bluesky", color: "#0085ff" },
  { key: "tumblr", label: "Tumblr", color: "#36465d" },
];

function statusFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("tumblr");
}

/** Console → Social settings: connect Tumblr's OAuth app, toggle whether new
 *  series/episodes auto-post, pick which platforms auto-post covers, and set
 *  default hashtags applied to every post alongside the content's own tags. */
export function SocialSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [callbackStatus, setCallbackStatus] = useState<string | null>(null);

  function load() {
    fetch("/api/console/social/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Settings | null) => {
        if (!d) return;
        setS(d);
        setTagsText(d.defaultTags.join(", "));
      });
  }

  useEffect(() => {
    load();
    setCallbackStatus(statusFromQuery());
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    const defaultTags = tagsText
      .split(",")
      .map((t) => t.trim().replace(/^#+/, ""))
      .filter(Boolean);
    const r = await fetch("/api/console/social/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnabled: s.autoEnabled, autoPlatforms: s.autoPlatforms, defaultTags }),
    });
    setSaving(false);
    setMsg(r.ok ? "Saved." : "Save failed — try again.");
  }

  async function disconnectTumblr() {
    setDisconnecting(true);
    await fetch("/api/console/social/tumblr/disconnect", { method: "POST" });
    setDisconnecting(false);
    load();
  }

  function togglePlatform(key: string) {
    if (!s) return;
    const has = s.autoPlatforms.includes(key);
    setS({ ...s, autoPlatforms: has ? s.autoPlatforms.filter((p) => p !== key) : [...s.autoPlatforms, key] });
  }

  if (!s) return null;

  return (
    <div className="space-y-4">
      {callbackStatus && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
            callbackStatus === "connected"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {callbackStatus === "connected"
            ? "Tumblr connected successfully."
            : callbackStatus === "denied"
              ? "Tumblr connection was denied."
              : "Tumblr connection failed — try again."}
        </div>
      )}

      {/* Platform connections */}
      <div className="rounded-2xl border border-line bg-surface/50 p-4">
        <h3 className="font-display text-sm font-bold">Platform connections</h3>
        <p className="mt-1 text-xs text-white/50">
          Bluesky posts get the real cover image — it fully allows explicit content. Tumblr posts are
          link-only (title, description, tags, link) with no image, since Tumblr&apos;s policy bans
          explicit imagery.
        </p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
              style={{ background: "#0085ff" }}
            >
              B
            </div>
            <span className="flex-1 text-sm font-medium text-white/85">Bluesky</span>
            {s.bluesky.configured ? (
              <span className="text-xs font-semibold text-emerald-400">Configured</span>
            ) : (
              <span className="text-xs font-semibold text-amber-400">No app password set</span>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
              style={{ background: "#001935" }}
            >
              t
            </div>
            <span className="flex-1 text-sm font-medium text-white/85">Tumblr</span>
            {!s.tumblr.configured ? (
              <span className="text-xs font-semibold text-amber-400">No consumer key set</span>
            ) : s.tumblr.connected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-400">Connected</span>
                <button
                  onClick={disconnectTumblr}
                  disabled={disconnecting}
                  className="text-xs font-medium text-white/40 hover:text-white/70 disabled:opacity-50"
                >
                  {disconnecting ? "…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href="/api/console/social/tumblr/connect"
                onClick={() => setConnecting(true)}
                className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-bold text-white"
              >
                {connecting ? "Redirecting…" : "Connect Tumblr"}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Auto-post */}
      <div className="rounded-2xl border border-line bg-surface/50 p-4">
        <h3 className="font-display text-sm font-bold">Auto-post on new content</h3>
        <p className="mt-1 text-xs text-white/50">
          When on, every new series and new episode that goes live is announced automatically on the
          checked platforms below. Existing series can still be posted manually from the series list.
        </p>

        <label className="mt-4 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={s.autoEnabled}
            onChange={(e) => setS({ ...s, autoEnabled: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm font-medium text-white/85">Auto-post enabled</span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label
              key={p.key}
              className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5"
            >
              <input
                type="checkbox"
                checked={s.autoPlatforms.includes(p.key)}
                onChange={() => togglePlatform(p.key)}
                className="h-3.5 w-3.5 accent-accent"
              />
              <span className="text-xs font-medium text-white/75">{p.label}</span>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium text-white/60">
          Default hashtags/tags (comma-separated, applied to every post alongside the content&apos;s own
          tags)
        </label>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="hentai, lusthentai"
          className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none focus:border-accent/50"
        />

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
    </div>
  );
}
