"use client";

import { useState, useTransition } from "react";
import {
  renameTag,
  setTagCategory,
  toggleTagFeatured,
  deleteTag,
  mergeTag,
  searchTagsForPicker,
} from "@/lib/tag-actions";
import { inputCls, btnCls, Badge } from "./ui";

const CATS = ["GENRE", "THEME", "FETISH", "FORMAT", "CONTENT_WARNING"];

type Tag = {
  id: string;
  name: string;
  slug: string;
  category: string;
  seriesCount: number;
  featured: boolean;
};

export function TagRow({ tag }: { tag: Tag }) {
  const [name, setName] = useState(tag.name);
  const [merging, setMerging] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-surface px-3 py-2 text-sm">
      <form
        action={(fd) => start(() => renameTag(tag.id, fd))}
        className="flex items-center gap-1.5"
      >
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} h-8 w-44 py-1`}
        />
        {name !== tag.name && (
          <button className={btnCls("secondary", "sm")} disabled={pending}>
            save
          </button>
        )}
      </form>

      <code className="text-[11px] text-white/30">/{tag.slug}</code>

      <select
        defaultValue={tag.category}
        onChange={(e) => start(() => setTagCategory(tag.id, e.target.value))}
        className={`${inputCls} h-8 w-40 py-1 text-xs`}
      >
        {CATS.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ").toLowerCase()}
          </option>
        ))}
      </select>

      <span className="tabular-nums text-white/45">{tag.seriesCount} series</span>

      <button
        onClick={() => start(() => toggleTagFeatured(tag.id, !tag.featured))}
        disabled={pending}
        className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition ${
          tag.featured
            ? "bg-accent/20 text-accent"
            : "bg-white/5 text-white/35 hover:text-white/60"
        }`}
      >
        {tag.featured ? "★ featured" : "feature"}
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {merging ? (
          <MergePicker
            onCancel={() => setMerging(false)}
            onPick={(intoId) => start(() => mergeTag(tag.id, intoId))}
            excludeId={tag.id}
          />
        ) : (
          <button
            onClick={() => setMerging(true)}
            className={btnCls("ghost", "sm")}
          >
            merge →
          </button>
        )}
        {tag.seriesCount === 0 && (
          <button
            onClick={() => {
              if (confirm(`Delete unused tag "${tag.name}"?`))
                start(() => deleteTag(tag.id));
            }}
            className={btnCls("ghost", "sm")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function MergePicker({
  onPick,
  onCancel,
  excludeId,
}: {
  onPick: (id: string) => void;
  onCancel: () => void;
  excludeId: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<
    { id: string; name: string; slug: string; seriesCount: number }[]
  >([]);
  const [searching, start] = useTransition();

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length >= 2)
              start(async () =>
                setHits(
                  (await searchTagsForPicker(e.target.value)).filter(
                    (t) => t.id !== excludeId,
                  ),
                ),
              );
          }}
          placeholder="merge into…"
          className={`${inputCls} h-8 w-40 py-1 text-xs`}
        />
        <button onClick={onCancel} className={btnCls("ghost", "sm")}>
          ✕
        </button>
      </div>
      {q.trim().length >= 2 && (
        <ul className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-white/15 bg-surface-2 text-xs shadow-xl">
          {searching && <li className="px-3 py-2 text-white/40">…</li>}
          {!searching && hits.length === 0 && (
            <li className="px-3 py-2 text-white/40">no match</li>
          )}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => onPick(h.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
              >
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                <Badge tone="slate">{h.seriesCount}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
