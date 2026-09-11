"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmAutoPublish } from "@/lib/scraper-actions";
import { setSeriesPublish } from "@/lib/actions";
import { SubmitButton } from "@/components/console/SubmitButton";
import { Card, Badge, SectionTitle, EmptyState, btnCls, timeAgo } from "@/components/console/ui";

export type AutoPubItem = {
  id: string;
  title: string;
  year: number | null;
  autoPublishedAt: string;
  episodeCount: number;
};

/** Auto-published spot-check queue: per-row actions plus a checkbox-driven
 *  bulk "Looks good" / "Unpublish" for clearing several at once. */
export function AutoPublishQueue({ items }: { items: AutoPubItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

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
      const failed = ids.filter((_, i) => results[i].status === "rejected");
      // drop the ones that succeeded so a retry only touches what's left
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
          {items.map((s) => (
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
                <form action={confirmAutoPublish.bind(null, s.id)}>
                  <SubmitButton variant="secondary" size="sm" pendingText="…">
                    Looks good
                  </SubmitButton>
                </form>
                <form action={setSeriesPublish.bind(null, s.id, "HIDDEN")}>
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Unpublish
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
