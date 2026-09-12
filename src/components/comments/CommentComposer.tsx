"use client";

import { useState } from "react";

export function CommentComposer({
  onSubmit,
  placeholder = "Add a comment…",
  autoFocus = false,
  compact = false,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<string | null>; // returns an error message, or null on success
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setErr(null);
    const e = await onSubmit(text);
    setBusy(false);
    if (e) {
      setErr(e);
    } else {
      setBody("");
      onCancel?.();
    }
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-line bg-surface/50 p-3"}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 2000))}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={compact ? 2 : 3}
        className="w-full resize-y rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/50 focus:border-accent/40 focus-visible:outline-none"
      />
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-white/50">{body.length}/2000</span>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          onClick={send}
          disabled={busy || body.trim().length < 2}
          className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Post"}
        </button>
      </div>
    </div>
  );
}
