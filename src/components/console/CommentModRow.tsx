"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentModRow({
  id,
  body,
  status,
  author,
  createdAt,
  replyCount = 0,
  report,
}: {
  id: string;
  body: string;
  status: string;
  author: string;
  createdAt: string;
  replyCount?: number;
  report?: { count: number; reasons: Record<string, number> };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function act(action: "delete" | "hide" | "restore" | "keep") {
    if (action === "delete" && !confirm("Hard-delete this comment and all its replies?"))
      return;
    setBusy(true);
    const r = await fetch(`/api/console/comments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (r.ok) {
      setDone(action === "keep" ? "kept" : action + "d");
      router.refresh();
    }
  }

  if (done) {
    return <p className="text-xs text-white/35">Comment {done}.</p>;
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
        <span className="font-semibold text-white/70">{author}</span>
        <span>{new Date(createdAt).toLocaleDateString()}</span>
        {replyCount > 0 && <span>· {replyCount} repl{replyCount === 1 ? "y" : "ies"}</span>}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            status === "HIDDEN" ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-white/40"
          }`}
        >
          {status}
        </span>
        {report && (
          <span className="text-red-300">
            {report.count} report{report.count === 1 ? "" : "s"} ·{" "}
            {Object.entries(report.reasons)
              .map(([k, n]) => `${k.toLowerCase().replace("_", " ")}×${n}`)
              .join(", ")}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words rounded-lg bg-black/20 px-3 py-2 text-sm text-white/80">
        {body}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => act("delete")}
          disabled={busy}
          className="rounded-md bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
        >
          Delete
        </button>
        {status !== "HIDDEN" && (
          <button
            onClick={() => act("hide")}
            disabled={busy}
            className="rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            Hide
          </button>
        )}
        {status === "HIDDEN" && (
          <button
            onClick={() => act("restore")}
            disabled={busy}
            className="rounded-md bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            Restore
          </button>
        )}
        {report && (
          <button
            onClick={() => act("keep")}
            disabled={busy}
            className="rounded-md px-3 py-1 text-xs text-white/40 hover:text-white disabled:opacity-50"
          >
            Keep &amp; dismiss reports
          </button>
        )}
      </div>
    </div>
  );
}
