"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmAutoPublish } from "@/lib/scraper-actions";
import { setSeriesPublish } from "@/lib/actions";
import { Card, Badge, SectionTitle, EmptyState, btnCls, timeAgo } from "@/components/console/ui";

export type AutoPubItem = {
  id: string;
  title: string;
  year: number | null;
  autoPublishedAt: string;
  episodeCount: number;
};

/**
 * Auto-published spot-check queue: per-row actions plus a checkbox-driven
 * bulk "Looks good" / "Unpublish" for clearing several at once.
 *
 * Rows are removed from view the moment their own action actually succeeds,
 * from local state — not by waiting on router.refresh() to bring back a
 * fresh server list. A directly-invoked Server Action (no <form>, called
 * from a plain onClick) isn't guaranteed to have its router.refresh() land
 * as a visible re-render on every Next.js/Turbopack dev build, so the
 * visible list can't depend on that succeeding. router.refresh() is still
 * called as a best-effort background sync (nav badge counts, etc.) — and
 * *because* it's best-effort, a stale round-trip that lands late must never
 * be allowed to resurrect a row this component already removed locally;
 * removedIds guards against exactly that.
 */
export function AutoPublishQueue({ items: initialItems }: { items: AutoPubItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const removedIds = useRef<Set<string>>(new Set());

  // Pick up a fresh server list whenever one arrives (e.g. a background
  // router.refresh() does land, or the admin navigates back here) — minus
  // anything we've already removed locally, so a late/stale refresh can't
  // bring a just-processed row back.
  useEffect(() => {
    setItems(initialItems.filter((i) => !removedIds.current.has(i.id)));
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(initialItems.map((i) => i.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [initialItems]);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((s) => s.id)));
  }

  function removeLocally(ids: Set<string>) {
    for (const id of ids) removedIds.current.add(id);
    setItems((prev) => prev.filter((it) => !ids.has(it.id)));
    setSelected((prev) => {
      if (![...ids].some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  async function runOne(id: string, action: "confirm" | "unpublish") {
    if (busyIds.has(id) || pending) return;
    setBusyIds((b) => new Set(b).add(id));
    try {
      await (action === "confirm" ? confirmAutoPublish(id) : setSeriesPublish(id, "HIDDEN"));
      removeLocally(new Set([id]));
      router.refresh();
    } catch {
      window.alert("That didn't go through. Try again.");
    } finally {
      setBusyIds((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  }

  function runBulk(action: "confirm" | "unpublish") {
    const ids = [...selected];
    if (ids.length === 0 || pending) return;
    if (
      action === "unpublish" &&
      !window.confirm(
        `Unpublish ${ids.length} series? They drop off the public site immediately.`,
      )
    )
      return;

    startTransition(async () => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          action === "confirm" ? confirmAutoPublish(id) : setSeriesPublish(id, "HIDDEN"),
        ),
      );
      const succeeded = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
      const failed = ids.filter((_, i) => results[i].status === "rejected");
      removeLocally(succeeded);
      setSelected(new Set(failed));
      router.refresh();
      if (failed.length > 0) {
        window.alert(
          `${failed.length} of ${ids.length} didn't go through. They're still selected — try again.`,
        );
      }
    });
  }

  return (
    <>
      <SectionTitle
        right={
          selected.size > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">{selected.size} selected</span>
              <button
                onClick={() => runBulk("confirm")}
                disabled={pending}
                className={`${btnCls("secondary", "sm")} disabled:cursor-wait disabled:opacity-60`}
              >
                {pending ? "…" : "Looks good"}
              </button>
              <button
                onClick={() => runBulk("unpublish")}
                disabled={pending}
                className={`${btnCls("danger", "sm")} disabled:cursor-wait disabled:opacity-60`}
              >
                {pending ? "…" : "Unpublish"}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                disabled={pending}
                className="text-white/35 transition-colors hover:text-white/60 disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          ) : undefined
        }
      >
        Auto-published — spot check{items.length > 0 ? ` (${items.length})` : ""}
      </SectionTitle>

      {items.length === 0 ? (
        <EmptyState title="Nothing to spot-check." hint="Scraper auto-publishes land here." />
      ) : (
        <div className="mb-8 grid gap-2">
          <label className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-white/35">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-accent"
            />
            Select all
          </label>
          {items.map((s) => {
            const busy = busyIds.has(s.id);
            return (
              <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-accent"
                  aria-label={`Select ${s.title}`}
                />
                <Badge tone="green">auto-published</Badge>
                <Link
                  href={`/console/series/${s.id}`}
                  className="min-w-0 flex-1 truncate font-medium text-white/85 hover:text-accent"
                >
                  {s.title}
                </Link>
                <span className="text-xs text-white/35">
                  {s.year ?? "—"} · {s.episodeCount} live ep · {timeAgo(s.autoPublishedAt)}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => runOne(s.id, "confirm")}
                    disabled={busy || pending}
                    className={`${btnCls("secondary", "sm")} disabled:cursor-wait disabled:opacity-60`}
                  >
                    {busy ? "…" : "Looks good"}
                  </button>
                  <button
                    onClick={() => runOne(s.id, "unpublish")}
                    disabled={busy || pending}
                    className={`${btnCls("ghost", "sm")} disabled:cursor-wait disabled:opacity-60`}
                  >
                    {busy ? "…" : "Unpublish"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
