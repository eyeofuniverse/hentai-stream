"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Server } from "@/lib/stream";

function Spinner() {
  return (
    <span className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-accent" />
    </span>
  );
}

export function WatchPlayer({
  servers,
  poster,
  nextHref,
}: {
  servers: Server[];
  poster?: string | null;
  nextHref?: string | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const cur = servers[active] ?? servers[0];

  // remembered server preference
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

  // HLS / native attach — only after the user hits play (keeps the page light)
  useEffect(() => {
    if (!started || !cur || cur.type !== "hls") return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = cur.src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let dead = false;
    import("hls.js").then(({ default: HlsJs }) => {
      if (dead || !HlsJs.isSupported()) {
        video.src = cur.src;
        return;
      }
      hls = new HlsJs({ maxBufferLength: 30 });
      hls.loadSource(cur.src);
      hls.attachMedia(video);
    });
    return () => {
      dead = true;
      hls?.destroy();
    };
  }, [started, cur]);

  // restore volume
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const stored = localStorage.getItem("lh_vol");
      if (stored != null) v.volume = Math.min(1, Math.max(0, Number(stored)));
    } catch {
      /* ignore */
    }
  }, [started]);

  const play = useCallback(() => {
    setStarted(true);
    setCountdown(null);
    queueMicrotask(() => videoRef.current?.play().catch(() => {}));
  }, []);

  const switchServer = (i: number) => {
    setActive(i);
    setStarted(true);
    try {
      localStorage.setItem("lh_server", servers[i].key);
    } catch {
      /* ignore */
    }
  };

  // keyboard shortcuts (when the player has focus / is hovered)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case "ArrowRight":
          v.currentTime += 10;
          break;
        case "ArrowLeft":
          v.currentTime -= 10;
          break;
        case "ArrowUp":
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "m":
          v.muted = !v.muted;
          break;
        case "f":
          if (document.fullscreenElement) document.exitFullscreen();
          else el.requestFullscreen?.();
          break;
        case "n":
          if (nextHref) router.push(nextHref);
          break;
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [nextHref, router]);

  // auto-advance countdown
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      if (nextHref) router.push(nextHref);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, nextHref, router]);

  if (!cur) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-surface text-sm text-white/40 sm:rounded-xl">
        No working sources yet — check back soon.
      </div>
    );
  }

  const iframe = started && cur.type === "iframe";

  return (
    <div>
      <div
        ref={wrapRef}
        tabIndex={0}
        className="group relative aspect-video w-full overflow-hidden bg-black shadow-card outline-none ring-1 ring-white/10 focus-visible:ring-accent/60 sm:rounded-xl"
      >
        {!started ? (
          <button
            type="button"
            onClick={play}
            aria-label="Play"
            className="absolute inset-0 h-full w-full"
          >
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                decoding="async"
              />
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-accent/90 text-white shadow-glow backdrop-blur-sm transition group-hover:scale-110">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        ) : iframe ? (
          <iframe
            key={cur.key}
            src={cur.src}
            title="Video player"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              key={cur.key}
              src={cur.type === "file" ? cur.src : undefined}
              poster={poster ?? undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onVolumeChange={(e) => {
                try {
                  localStorage.setItem("lh_vol", String((e.target as HTMLVideoElement).volume));
                } catch {
                  /* ignore */
                }
              }}
              onEnded={() => nextHref && setCountdown(10)}
              className="h-full w-full bg-black"
            />
            {buffering && <Spinner />}
          </>
        )}

        {countdown != null && nextHref && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-sm text-white/60">Next episode in</p>
              <p className="my-1 font-display text-5xl font-extrabold text-white">{countdown}</p>
              <div className="mt-2 flex justify-center gap-2">
                <button
                  onClick={() => router.push(nextHref)}
                  className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-1.5 text-sm font-bold text-white"
                >
                  Play now
                </button>
                <button
                  onClick={() => setCountdown(null)}
                  className="rounded-lg border border-white/20 px-4 py-1.5 text-sm text-white/70"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-0">
        {servers.length > 1 && (
          <>
            <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Servers
            </span>
            {servers.map((sv, i) => (
              <button
                key={sv.key}
                onClick={() => switchServer(i)}
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
                <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">{sv.kind}</span>
                {sv.quality && (
                  <span className="rounded bg-black/25 px-1 py-px text-[10px] font-bold">
                    {sv.quality}
                  </span>
                )}
              </button>
            ))}
          </>
        )}
        <span className="ml-auto hidden text-[11px] text-white/25 sm:block">
          space play · ← → seek · f full · m mute{nextHref ? " · n next" : ""}
        </span>
      </div>
    </div>
  );
}
