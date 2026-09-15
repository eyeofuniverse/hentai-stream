"use client";

import { useState } from "react";
import { Share2, X, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

type Results = Partial<Record<"bluesky" | "tumblr", { ok: true } | { ok: false; error: string }>>;

function sanitizeTag(t: string) {
  return t.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

export function PromoteButton({
  seriesId,
  seriesTitle,
  seriesSynopsis,
  seriesUrl,
  coverImageUrl,
  defaultTags = [],
  blueskyAvailable,
  tumblrAvailable,
  posted,
}: {
  seriesId: string;
  seriesTitle: string;
  seriesSynopsis: string;
  seriesUrl: string;
  coverImageUrl: string | null;
  defaultTags?: string[];
  blueskyAvailable: boolean;
  tumblrAvailable: boolean;
  posted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title = `New series: ${seriesTitle}`;
  const [platforms, setPlatforms] = useState<string[]>(
    [blueskyAvailable && "bluesky", tumblrAvailable && "tumblr"].filter(Boolean) as string[],
  );
  const [blueskyCaption, setBlueskyCaption] = useState(() => seriesSynopsis.slice(0, 240));
  const [tumblrDescription, setTumblrDescription] = useState(() => seriesSynopsis.slice(0, 400));
  const [tags, setTags] = useState<string[]>(defaultTags.map(sanitizeTag).filter(Boolean));
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  const titleChars = title.length + 2;
  const urlChars = 2 + [...seriesUrl].length;
  const hashtagChars = tags.reduce((acc, t) => acc + 2 + t.length, 0);
  const bskyTotal = titleChars + blueskyCaption.length + urlChars + hashtagChars;
  const bskyOver = bskyTotal > 300;

  const hasPlatform = platforms.length > 0;
  const bskyEmpty = platforms.includes("bluesky") && !blueskyCaption.trim();
  const canPost = !loading && hasPlatform && !bskyOver && !bskyEmpty;

  async function handlePost() {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/console/social/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          platforms,
          blueskyCaption: blueskyCaption.trim(),
          tumblrDescription: tumblrDescription.trim(),
          tags,
        }),
      });
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({ bluesky: { ok: false, error: "Network error" } });
    } finally {
      setLoading(false);
    }
  }

  function addTag() {
    const tag = sanitizeTag(tagInput.trim().replace(/^#+/, ""));
    if (tag && !tags.includes(tag) && tags.length < 15) setTags((t) => [...t, tag]);
    setTagInput("");
  }

  function togglePlatform(key: string) {
    setPlatforms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  const allSucceeded = results != null && Object.values(results).every((r) => r?.ok);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={posted ? "Post to Bluesky / Tumblr again" : "Post to Bluesky / Tumblr"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-accent"
      >
        <Share2 size={15} className={posted ? "opacity-60" : ""} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:max-w-lg sm:rounded-2xl"
            style={{ maxHeight: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-accent" />
                <span className="text-sm font-semibold text-white/90">Promote series</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Series</p>
                <p className="line-clamp-2 text-sm font-semibold text-white/90">{seriesTitle}</p>
                {posted && <p className="mt-1 text-[11px] text-amber-400/80">Already posted once — this will post again.</p>}
              </div>

              {!results && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Platforms</p>
                    <div className="flex gap-2">
                      {blueskyAvailable && (
                        <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={platforms.includes("bluesky")}
                            onChange={() => togglePlatform("bluesky")}
                            className="h-3.5 w-3.5 accent-accent"
                          />
                          <span className="text-xs font-medium text-white/75">Bluesky</span>
                        </label>
                      )}
                      {tumblrAvailable && (
                        <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={platforms.includes("tumblr")}
                            onChange={() => togglePlatform("tumblr")}
                            className="h-3.5 w-3.5 accent-accent"
                          />
                          <span className="text-xs font-medium text-white/75">Tumblr</span>
                        </label>
                      )}
                      {!blueskyAvailable && !tumblrAvailable && (
                        <p className="text-xs text-amber-400/80">
                          No platform connected yet — set it up on the Social settings page.
                        </p>
                      )}
                    </div>
                  </div>

                  {platforms.includes("bluesky") && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wide text-white/40">
                          Bluesky caption
                        </label>
                        <span className={`text-xs tabular-nums ${bskyOver ? "text-red-400" : "text-white/40"}`}>
                          {bskyTotal}/300
                        </span>
                      </div>
                      <textarea
                        value={blueskyCaption}
                        onChange={(e) => setBlueskyCaption(e.target.value)}
                        rows={3}
                        className={`w-full resize-none rounded-lg border bg-bg px-3 py-2 text-sm text-white/85 outline-none ${
                          bskyOver ? "border-red-500/50" : "border-line focus:border-accent/50"
                        }`}
                        placeholder="Short caption — cover image, title, link and hashtags all count toward 300…"
                      />
                      {coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImageUrl} alt="" className="mt-2 h-16 w-11 rounded object-cover" />
                      )}
                    </div>
                  )}

                  {platforms.includes("tumblr") && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
                        Tumblr description
                      </label>
                      <textarea
                        value={tumblrDescription}
                        onChange={(e) => setTumblrDescription(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none focus:border-accent/50"
                        placeholder="Link post — title, description, tags and link only, no image (Tumblr bans explicit imagery)…"
                      />
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                      Tags ({tags.length}/15)
                    </p>
                    {tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent"
                          >
                            #{tag}
                            <button onClick={() => setTags((t) => t.filter((x) => x !== tag))} className="leading-none">
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Add tag…"
                        className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none focus:border-accent/50"
                      />
                      <button
                        onClick={addTag}
                        className="rounded-lg border border-line bg-bg px-3 py-2 text-sm font-semibold text-white/75"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </>
              )}

              {results &&
                Object.entries(results).map(([platform, r]) => (
                  <div
                    key={platform}
                    className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5"
                  >
                    <span className="flex-1 text-sm font-medium capitalize text-white/85">{platform}</span>
                    {r?.ok ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle size={14} /> Posted
                      </span>
                    ) : (
                      <span className="flex max-w-[220px] items-center gap-1.5 text-right text-xs font-semibold text-red-400">
                        <XCircle size={14} className="shrink-0" /> {(r as { error: string })?.error}
                      </span>
                    )}
                  </div>
                ))}

              {allSucceeded ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-400">
                  <CheckCircle size={15} /> Posted successfully!
                </div>
              ) : results ? (
                <button
                  onClick={() => setResults(null)}
                  className="w-full rounded-xl border border-line bg-bg py-2.5 text-sm font-semibold text-white/80"
                >
                  Try again
                </button>
              ) : (
                <button
                  onClick={handlePost}
                  disabled={!canPost}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Posting…
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Post
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
