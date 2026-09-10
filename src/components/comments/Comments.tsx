"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommentComposer } from "./CommentComposer";
import { CommentItem, type CommentNode } from "./CommentItem";

type Sort = "new" | "old" | "top";

export function Comments({
  targetType,
  targetId,
  title = "Comments",
}: {
  targetType: "series" | "episode";
  targetId: string;
  title?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CommentNode[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [signedIn, setSignedIn] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const qs = (c?: string | null) =>
    `/api/comments?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}&sort=${sort}${
      c ? `&cursor=${c}` : ""
    }`;

  const load = useCallback(
    async (replace: boolean) => {
      replace ? setLoading(true) : setLoadingMore(true);
      try {
        const r = await fetch(qs(replace ? null : cursor));
        if (r.ok) {
          const d = await r.json();
          setItems((prev) => (replace ? d.items : [...prev, ...d.items]));
          setCursor(d.nextCursor);
          setSignedIn(!!d.signedIn);
          setCanModerate(!!d.canModerate);
          if (replace && typeof d.total === "number") setTotal(d.total);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor, sort, targetType, targetId],
  );

  // initial load + reload on sort / target change
  useEffect(() => {
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, targetId]);

  const needAuth = () =>
    router.push(`/login?next=${encodeURIComponent(location.pathname)}`);

  async function post(body: string, parentId: string | null): Promise<string | null> {
    const r = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, body, parentId }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) {
      needAuth();
      return null;
    }
    if (!r.ok) return d.error ?? "Couldn't post that.";

    const node: CommentNode = { ...d, replies: [] };
    if (parentId) {
      setItems((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), node], replyCount: c.replyCount + 1 }
            : c,
        ),
      );
    } else {
      setItems((prev) => (sort === "old" ? [...prev, node] : [node, ...prev]));
    }
    setTotal((t) => (t == null ? t : t + 1));
    return null;
  }

  async function edit(id: string, body: string): Promise<string | null> {
    const r = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return d.error ?? "Couldn't save.";
    }
    setItems((prev) =>
      prev.map((c) => ({
        ...c,
        body: c.id === id ? body : c.body,
        edited: c.id === id ? true : c.edited,
        replies: (c.replies ?? []).map((rp) =>
          rp.id === id ? { ...rp, body, edited: true } : rp,
        ),
      })),
    );
    return null;
  }

  async function del(id: string, isReply: boolean) {
    await fetch(`/api/comments/${id}`, { method: "DELETE" }).catch(() => {});
    if (isReply) {
      setItems((prev) =>
        prev.map((c) => ({
          ...c,
          replies: (c.replies ?? []).filter((r) => r.id !== id),
          replyCount: (c.replies ?? []).some((r) => r.id === id)
            ? Math.max(0, c.replyCount - 1)
            : c.replyCount,
        })),
      );
    } else {
      setItems((prev) => prev.filter((c) => c.id !== id));
    }
    setTotal((t) => (t == null ? t : Math.max(0, t - 1)));
  }

  const SORTS: { k: Sort; l: string }[] = [
    { k: "new", l: "Newest" },
    { k: "top", l: "Top" },
    { k: "old", l: "Oldest" },
  ];

  return (
    <section id="comments" className="mt-12">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
          {title}
          {total != null && <span className="text-sm font-normal text-white/35">{total}</span>}
        </h2>
        <div className="ml-auto flex gap-1 text-xs">
          {SORTS.map((s) => (
            <button
              key={s.k}
              onClick={() => setSort(s.k)}
              className={`rounded px-2 py-1 transition ${
                sort === s.k ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {signedIn ? (
        <CommentComposer onSubmit={(b) => post(b, null)} placeholder="Add a comment…" />
      ) : (
        <button
          onClick={needAuth}
          className="w-full rounded-xl border border-line bg-surface/50 px-4 py-3 text-left text-sm text-white/45 transition hover:border-accent/30 hover:text-white"
        >
          Sign in to join the conversation
        </button>
      )}

      <div className="mt-6 space-y-6">
        {loading ? (
          <p className="py-6 text-center text-sm text-white/35">Loading comments…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/35">
            No comments yet. Be the first.
          </p>
        ) : (
          items.map((c) => (
            <CommentItem
              key={c.id}
              node={c}
              canModerate={canModerate}
              signedIn={signedIn}
              onReply={(pid, b) => post(b, pid)}
              onEdit={edit}
              onDelete={del}
              onNeedAuth={needAuth}
            />
          ))
        )}
      </div>

      {cursor && !loading && (
        <div className="mt-6 text-center">
          <button
            onClick={() => load(false)}
            disabled={loadingMore}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-white/70 hover:border-accent/40 hover:text-white disabled:opacity-50"
          >
            {loadingMore ? "…" : "Load more comments"}
          </button>
        </div>
      )}
    </section>
  );
}
