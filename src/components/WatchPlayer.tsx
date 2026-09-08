"use client";

import { useEffect, useState } from "react";

export type PlayerSource = {
  id: string;
  host: string;
  hostName?: string | null;
  embedUrl: string;
  kind: string; // SUB | DUB | RAW
  language: string;
  quality: string | null;
  direct?: boolean;
};

const HOST_LABEL: Record<string, string> = {
  STREAMTAPE: "Streamtape",
  DOODSTREAM: "Doodstream",
  MIXDROP: "Mixdrop",
  VOE: "VOE",
  STREAMWISH: "Streamwish",
  FILEMOON: "Filemoon",
  MP4UPLOAD: "Mp4upload",
  VIDGUARD: "Vidguard",
  LULUSTREAM: "Lulustream",
  BIGWARP: "Bigwarp",
  YOURUPLOAD: "Yourupload",
  OTHER: "Mirror",
};

const qLabel = (q: string | null) =>
  q && q !== "UNKNOWN" ? q.replace("Q", "") + "p" : null;

export function WatchPlayer({ sources }: { sources: PlayerSource[] }) {
  const [activeId, setActiveId] = useState(sources[0]?.id);

  useEffect(() => {
    try {
      const pref = localStorage.getItem("hs_host");
      const match = sources.find((s) => s.host === pref);
      if (match) setActiveId(match.id);
    } catch {
      /* ignore */
    }
  }, [sources]);

  const active = sources.find((s) => s.id === activeId) ?? sources[0];

  if (!active) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl bg-surface text-sm text-white/40">
        No working sources — try again later or report it.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
        <div className="aspect-video">
          {active.direct ? (
            <video
              key={active.id}
              src={active.embedUrl}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black"
            />
          ) : (
            <iframe
              key={active.id}
              src={active.embedUrl}
              title="Player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>

      {sources.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                try {
                  localStorage.setItem("hs_host", s.host);
                } catch {
                  /* ignore */
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                s.id === active.id
                  ? "bg-accent font-semibold"
                  : "bg-surface text-white/70 hover:bg-surface-2"
              }`}
            >
              Server {i + 1} ·{" "}
              {s.host === "OTHER" && s.hostName ? s.hostName : HOST_LABEL[s.host] ?? s.host}
              <span className="ml-1.5 inline-flex gap-1 align-middle">
                <span className="rounded bg-black/25 px-1 py-px text-[10px] font-semibold">
                  {s.kind}
                  {s.language !== "en" ? ` ${s.language.toUpperCase()}` : ""}
                </span>
                {qLabel(s.quality) && (
                  <span className="rounded bg-black/25 px-1 py-px text-[10px] font-semibold">
                    {qLabel(s.quality)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
