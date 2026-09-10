"use client";

import { useState } from "react";
import { ReactionBar, type Reaction } from "./ReactionBar";
import { CommentComposer } from "./CommentComposer";

export type CommentNode = {
  id: string;
  parentId: string | null;
  body: string;
  edited: boolean;
  createdAt: string;
  author: { handle: string; displayName: string | null; avatarUrl: string | null } | null;
  isMine: boolean;
  reactions: Reaction[];
  replyCount: number;
  replies?: CommentNode[];
};

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function Body({ text }: { text: string }) {
  // split() with a capture group → [text, url, text, url, …]; odd indices are URLs
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="nofollow noopener ugc"
            className="text-accent hover:underline"
          >
            {p.length > 60 ? p.slice(0, 57) + "…" : p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

const REPORT_REASONS: { v: string; l: string }[] = [
  { v: "SPAM", l: "Spam or scam" },
  { v: "ABUSE", l: "Harassment or hate" },
  { v: "NON_CONSENSUAL", l: "Non-consensual / illegal" },
  { v: "UNDERAGE", l: "Sexualises a minor" },
  { v: "OTHER", l: "Something else" },
];

export function CommentItem({
  node,
  canModerate,
  signedIn,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
  onNeedAuth,
}: {
  node: CommentNode;
  canModerate: boolean;
  signedIn: boolean;
  isReply?: boolean;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onEdit: (id: string, body: string) => Promise<string | null>;
  onDelete: (id: string, isReply: boolean) => Promise<void>;
  onNeedAuth: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  const name = node.author?.displayName || node.author?.handle || "deleted user";
  const replies = node.replies ?? [];

  async function report(reason: string) {
    setReportOpen(false);
    setReported(true);
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "comment", targetId: node.id, reason }),
    }).catch(() => {});
  }

  async function del() {
    if (!confirm(isReply ? "Delete this reply?" : "Delete this comment and its replies?"))
      return;
    setDeleted(true);
    await onDelete(node.id, isReply);
  }

  return (
    <div className={isReply ? "flex gap-2.5" : "flex gap-3"}>
      <span
        className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-bold text-white/40 ring-1 ring-white/10 ${
          isReply ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs"
        }`}
      >
        {node.author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.author.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-white/85">{name}</span>
          <span className="text-white/30">{ago(node.createdAt)}</span>
          {node.edited && <span className="text-white/25">· edited</span>}
        </div>

        {editing ? (
          <div className="mt-1.5">
            <CommentComposer
              compact
              autoFocus
              placeholder="Edit your comment…"
              onCancel={() => setEditing(false)}
              onSubmit={async (b) => {
                const e = await onEdit(node.id, b);
                if (!e) setEditing(false);
                return e;
              }}
            />
          </div>
        ) : (
          <Body text={node.body} />
        )}

        <ReactionBar
          commentId={node.id}
          reactions={node.reactions}
          signedIn={signedIn}
          onNeedAuth={onNeedAuth}
        />

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
          {!isReply && (
            <button
              onClick={() => (signedIn ? setReplying((r) => !r) : onNeedAuth())}
              className="font-medium hover:text-white"
            >
              Reply
            </button>
          )}
          {node.isMine && !editing && (
            <button onClick={() => setEditing(true)} className="hover:text-white">
              Edit
            </button>
          )}
          {(node.isMine || canModerate) && (
            <button onClick={del} className="hover:text-red-400">
              Delete
            </button>
          )}
          {signedIn && !node.isMine && (
            <div className="relative">
              <button
                onClick={() => setReportOpen((o) => !o)}
                disabled={reported}
                className="hover:text-white disabled:opacity-50"
              >
                {reported ? "Reported" : "Report"}
              </button>
              {reportOpen && (
                <div className="absolute left-0 top-5 z-30 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r.v}
                      onClick={() => report(r.v)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      {r.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {replying && (
          <div className="mt-2">
            <CommentComposer
              compact
              autoFocus
              placeholder={`Reply to ${name}…`}
              onCancel={() => setReplying(false)}
              onSubmit={async (b) => {
                const e = await onReply(node.id, b);
                if (!e) {
                  setReplying(false);
                  setShowReplies(true);
                }
                return e;
              }}
            />
          </div>
        )}

        {!isReply && replies.length > 0 && (
          <div className="mt-2">
            {replies.length > 2 && !showReplies ? (
              <button
                onClick={() => setShowReplies(true)}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                View {replies.length} replies
              </button>
            ) : (
              <div className="space-y-3 border-l border-line pl-3">
                {(showReplies ? replies : replies.slice(0, 2)).map((r) => (
                  <CommentItem
                    key={r.id}
                    node={r}
                    isReply
                    canModerate={canModerate}
                    signedIn={signedIn}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onNeedAuth={onNeedAuth}
                  />
                ))}
                {!showReplies && replies.length > 2 && (
                  <button
                    onClick={() => setShowReplies(true)}
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    View {replies.length - 2} more
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
