"use client";

import { useEffect, useRef, useState } from "react";

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

export type HostedVideo = { guid: string; hls: string; poster?: string | null } | null;

const CDN = process.env.NEXT_PUBLIC_BUNNY_CDN_HOST;

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
  sources,
  hosted,
}: {
  sources: PlayerSource[];
  hosted?: HostedVideo;
}) {
  // the hosted copy is always option 0 when present
  const options: (
    | { kind: "hosted"; hls: string; poster?: string | null }
    | { kind: "source"; src: PlayerSource }
  )[] = [
    ...(hosted && CDN ? [{ kind: "hosted" as const, hls: hosted.hls, poster: hosted.poster }] : []),
    ...sources.map((s) => ({ kind: "source" as const, src: s })),
  ];

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (hosted) return; // hosted always wins
    try {
      const pref = localStorage.getItem("hs_host");
      const i = options.findIndex((o) => o.kind === "source" && o.src.host === pref);
      if (i >= 0) setActive(i);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length, hosted]);

  const cur = options[active] ?? options[0];

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
          {cur.kind === "hosted" ? (
            <Hls key="hosted" src={cur.hls} poster={cur.poster} />
          ) : cur.src.direct ? (
            <video
              key={cur.src.id}
              src={cur.src.embedUrl}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black"
            />
          ) : (
            <iframe
              key={cur.src.id}
              src={cur.src.embedUrl}
              title="Player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>

      {options.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3 sm:px-0">
          <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Servers
          </span>
          {options.map((o, i) => (
            <button
              key={i}
              onClick={() => {
                setActive(i);
                if (o.kind === "source") {
                  try {
                    localStorage.setItem("hs_host", o.src.host);
                  } catch {
                    /* ignore */
                  }
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                i === active
                  ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow"
                  : "border border-line bg-surface text-white/70 hover:border-accent/40 hover:text-white"
              }`}
            >
              {o.kind === "hosted" ? (
                <>
                  <Dot on={i === active} /> Server {i + 1}
                  <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">HD</span>
                </>
              ) : (
                <>
                  <Dot on={i === active} /> Server {i + 1}
                  <span className="opacity-70">
                    {o.src.host === "OTHER" && o.src.hostName
                      ? o.src.hostName
                      : HOST_LABEL[o.src.host] ?? o.src.host}
                  </span>
                  <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">
                    {o.src.kind}
                    {o.src.language !== "en" ? ` ${o.src.language.toUpperCase()}` : ""}
                  </span>
                  {qLabel(o.src.quality) && (
                    <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">
                      {qLabel(o.src.quality)}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white" : "bg-good"}`}
    />
  );
}
