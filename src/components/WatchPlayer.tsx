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

/**
 * One player, no visible source machinery. Plays the best server; on a playback
 * error it silently falls through to the next. Bunny-hosted episodes use the
 * Bunny embed (skinned in the Bunny dashboard); mirrors use a locked-down
 * <video> (no download, no PiP, no context menu).
 */
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

  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dead, setDead] = useState(false);

  const cur = servers[idx];

  // silent failover to the next server
  const failover = useCallback(() => {
    setBuffering(false);
    setIdx((i) => {
      if (i + 1 < servers.length) return i + 1;
      setDead(true);
      return i;
    });
  }, [servers.length]);

  // HLS attach (only the non-embed hls type; runs after play)
  useEffect(() => {
    if (!started || !cur || cur.type !== "hls") return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = cur.src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let killed = false;
    import("hls.js").then(({ default: HlsJs }) => {
      if (killed || !HlsJs.isSupported()) {
        video.src = cur.src;
        return;
      }
      hls = new HlsJs({ maxBufferLength: 30 });
      hls.loadSource(cur.src);
      hls.attachMedia(video);
      hls.on(HlsJs.Events.ERROR, (_e, data) => {
        if (data.fatal) failover();
      });
    });
    return () => {
      killed = true;
      hls?.destroy();
    };
  }, [started, cur, failover]);

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
  }, [started, idx]);

  const play = useCallback(() => {
    setStarted(true);
    setCountdown(null);
    queueMicrotask(() => videoRef.current?.play().catch(() => {}));
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (v) v.paused ? v.play() : v.pause();
          break;
        case "ArrowRight":
          if (v) v.currentTime += 10;
          break;
        case "ArrowLeft":
          if (v) v.currentTime -= 10;
          break;
        case "ArrowUp":
          if (v) v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          if (v) v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "m":
          if (v) v.muted = !v.muted;
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

  if (!cur || dead) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-surface text-center text-sm text-white/40 sm:rounded-xl">
        Can&apos;t play this episode right now — please check back shortly.
      </div>
    );
  }

  return (
    <div>
      <div
        ref={wrapRef}
        tabIndex={0}
        onContextMenu={(e) => e.preventDefault()}
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
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
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
        ) : cur.type === "bunny" || cur.type === "iframe" ? (
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
              controlsList="nodownload noremoteplayback noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onError={failover}
              onStalled={() => setBuffering(true)}
              onVolumeChange={(e) => {
                try {
                  localStorage.setItem(
                    "lh_vol",
                    String((e.target as HTMLVideoElement).volume),
                  );
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
              <p className="my-1 font-display text-5xl font-extrabold text-white">
                {countdown}
              </p>
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

      <p className="mt-2 hidden px-4 text-[11px] text-white/25 sm:block sm:px-0">
        space play · ← → seek 10s · f fullscreen · m mute{nextHref ? " · n next episode" : ""}
      </p>
    </div>
  );
}
