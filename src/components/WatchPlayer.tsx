"use client";

import { useEffect, useRef, useState } from "react";
import type { Server } from "@/lib/stream";

/** HLS <video> — native on Safari, hls.js everywhere else. */
function Hls({ src, poster }: { src: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let cancelled = false;
    import("hls.js").then(({ default: HlsJs }) => {
      if (cancelled || !HlsJs.isSupported()) {
        video.src = src;
        return;
      }
      hls = new HlsJs({ maxBufferLength: 30 });
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      className="h-full w-full bg-black"
    />
  );
}

export function WatchPlayer({
  servers,
  poster,
}: {
  servers: Server[];
  poster?: string | null;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    try {
      const pref = localStorage.getItem("lh_server");
      const i = servers.findIndex((s) => s.key === pref);
      if (i > 0) setActive(i);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length]);

  const cur = servers[active] ?? servers[0];

  if (!cur) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-surface text-sm text-white/40 sm:rounded-xl">
        No working sources yet — check back soon.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden bg-black shadow-card ring-1 ring-white/10 sm:rounded-xl">
        <div className="aspect-video">
          {cur.type === "hls" ? (
            <Hls key={cur.key} src={cur.src} poster={poster} />
          ) : cur.type === "file" ? (
            <video
              key={cur.key}
              src={cur.src}
              poster={poster ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black"
            />
          ) : (
            <iframe
              key={cur.key}
              src={cur.src}
              title="Video player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>

      {servers.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3 sm:px-0">
          <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Servers
          </span>
          {servers.map((sv, i) => (
            <button
              key={sv.key}
              onClick={() => {
                setActive(i);
                try {
                  localStorage.setItem("lh_server", sv.key);
                } catch {
                  /* ignore */
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                i === active
                  ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
                  : "border border-line bg-surface text-white/70 hover:border-accent/40 hover:text-white"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${i === active ? "bg-white" : "bg-good"}`}
              />
              Server {i + 1}
              <span className="opacity-70">{sv.label}</span>
              <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">
                {sv.kind}
              </span>
              {sv.quality && (
                <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">
                  {sv.quality}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
