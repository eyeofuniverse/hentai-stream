"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Server } from "@/lib/stream";
import { gradientFor } from "@/lib/gradient";

function Spinner({ label }: { label?: string }) {
  return (
    <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/30">
      <span className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
        {label && <span className="text-xs font-medium text-white/60">{label}</span>}
      </span>
    </span>
  );
}

/**
 * One player, no visible source machinery beyond a discreet "server" switch for
 * manual recovery. Plays the best server; on a playback error it silently falls
 * through to the next. Bunny-hosted episodes use the Bunny embed; mirrors use a
 * locked-down <video> (no download, no PiP, no context menu).
 */
export function WatchPlayer({
  servers,
  poster,
  title,
  episodeLabel,
  nextHref,
  prevHref,
}: {
  servers: Server[];
  poster?: string | null;
  title?: string;
  episodeLabel?: string;
  nextHref?: string | null;
  prevHref?: string | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false); // first frame / iframe loaded
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [menu, setMenu] = useState(false);

  const cur = servers[idx];

  // remembered "autoplay next" preference
  useEffect(() => {
    try {
      setAutoplay(localStorage.getItem("lh_autoplay") !== "0");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleAutoplay = useCallback(() => {
    setAutoplay((v) => {
      const next = !v;
      try {
        localStorage.setItem("lh_autoplay", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next) setCountdown(null);
      return next;
    });
  }, []);

  // reset the "loading" veil whenever the active server changes
  useEffect(() => {
    if (started) setReady(false);
  }, [idx, started]);

  // safety: never let the loading veil hang forever (iframe with no load event)
  useEffect(() => {
    if (!started || ready) return;
    const t = setTimeout(() => setReady(true), 9000);
    return () => clearTimeout(t);
  }, [started, ready, idx]);

  // silent failover to the next server
  const failover = useCallback(() => {
    setIdx((i) => {
      if (i + 1 < servers.length) return i + 1;
      setDead(true);
      return i;
    });
  }, [servers.length]);

  const pickServer = useCallback((i: number) => {
    setDead(false);
    setMenu(false);
    setIdx(i);
    setStarted(true);
  }, []);

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
      if (killed) return;
      if (!HlsJs.isSupported()) {
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
  }, []);

  // the <video> mounts a render after `started` flips, so kick playback here —
  // this still counts as user-initiated (the play button was just clicked)
  useEffect(() => {
    if (!started || !cur || cur.type === "bunny" || cur.type === "iframe") return;
    videoRef.current?.play().catch(() => {});
  }, [started, idx, cur]);

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
        case "p":
          if (prevHref) router.push(prevHref);
          break;
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [nextHref, prevHref, router]);

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

  const frame =
    "group relative aspect-video w-full overflow-hidden bg-black shadow-card outline-none ring-1 ring-white/10 focus-visible:ring-accent/60 sm:rounded-2xl";

  if (!cur || dead) {
    return (
      <div className={frame.replace("group ", "")}>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-white/60">
              Can&apos;t play this episode right now.
            </p>
            {servers.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {servers.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => pickServer(i)}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 hover:border-accent/40 hover:text-white"
                  >
                    Server {i + 1}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-white/30">
              Or check back shortly — mirrors refresh automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ambient glow — a soft, blurred wash of the poster behind the frame */}
      {poster && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-8 bottom-4 -z-10 overflow-hidden opacity-30 blur-3xl saturate-150"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div
        ref={wrapRef}
        tabIndex={0}
        onContextMenu={(e) => e.preventDefault()}
        className={frame}
      >
        {!started ? (
          <button
            type="button"
            onClick={play}
            aria-label={`Play ${title ?? "episode"}`}
            className="absolute inset-0 h-full w-full"
            style={poster ? undefined : { backgroundImage: gradientFor(cur.key) }}
          >
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

            {(episodeLabel || title) && (
              <span className="absolute inset-x-0 top-0 flex flex-col gap-1 p-4 text-left sm:p-6">
                {episodeLabel && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
                    {episodeLabel}
                  </span>
                )}
                {title && (
                  <span className="line-clamp-2 font-display text-lg font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
                    {title}
                  </span>
                )}
              </span>
            )}

            <span className="absolute inset-0 grid place-items-center">
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-glow transition duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="relative ml-1">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>

            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-4 text-[11px] text-white/50 sm:p-5">
              <span>
                {servers.length} server{servers.length === 1 ? "" : "s"} · HD
              </span>
              <span className="hidden sm:block">Click anywhere to play</span>
            </span>
          </button>
        ) : cur.type === "bunny" || cur.type === "iframe" ? (
          <>
            <iframe
              key={cur.key}
              src={cur.src}
              title="Video player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setReady(true)}
              className="h-full w-full border-0"
            />
            {!ready && <Spinner label="Loading…" />}
          </>
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
              preload="auto"
              controlsList="nodownload noremoteplayback noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              onLoadedData={() => setReady(true)}
              onCanPlay={() => setReady(true)}
              onPlaying={() => setReady(true)}
              onError={failover}
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
              onEnded={() => nextHref && autoplay && setCountdown(10)}
              className="h-full w-full bg-black"
            />
            {!ready && <Spinner label="Loading…" />}
          </>
        )}

        {/* chrome — sits above the player; only the buttons take clicks. Shown
            while loading (so touch users see the server switch), then fades and
            only returns on hover. */}
        {started && (
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2.5 transition-opacity duration-200 group-hover:opacity-100 sm:p-3 ${
              ready ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="min-w-0 pt-1 pl-1">
              {episodeLabel && (
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {episodeLabel}
                </p>
              )}
              {title && (
                <p className="truncate text-xs font-semibold text-white/90 sm:text-sm">
                  {title}
                </p>
              )}
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              {nextHref && (
                <button
                  onClick={() => toggleAutoplay()}
                  title={autoplay ? "Autoplay is on" : "Autoplay is off"}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold backdrop-blur-sm transition ${
                    autoplay
                      ? "bg-accent/90 text-white"
                      : "bg-black/50 text-white/60 hover:text-white"
                  }`}
                >
                  Auto ▸
                </button>
              )}
              {servers.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setMenu((v) => !v)}
                    className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition hover:text-white"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Server {idx + 1}
                  </button>
                  {menu && (
                    <div className="absolute right-0 top-full mt-1 w-40 overflow-hidden rounded-lg border border-white/10 bg-black/90 p-1 backdrop-blur-md">
                      {servers.map((s, i) => (
                        <button
                          key={s.key}
                          onClick={() => pickServer(i)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition ${
                            i === idx
                              ? "bg-accent/20 text-white"
                              : "text-white/65 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Server {i + 1}</span>
                          {s.quality && (
                            <span className="text-[10px] text-white/40">
                              {s.quality}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {countdown != null && nextHref && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/75 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-sm text-white/60">Next episode in</p>
              <p className="my-1 font-display text-6xl font-extrabold text-white tabular-nums">
                {countdown}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={() => router.push(nextHref)}
                  className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-5 py-2 text-sm font-bold text-white"
                >
                  Play now
                </button>
                <button
                  onClick={() => setCountdown(null)}
                  className="rounded-lg border border-white/20 px-5 py-2 text-sm text-white/70 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 hidden px-1 text-[11px] text-white/25 sm:block">
        <kbd className="text-white/40">space</kbd> play ·{" "}
        <kbd className="text-white/40">← →</kbd> seek ·{" "}
        <kbd className="text-white/40">f</kbd> fullscreen ·{" "}
        <kbd className="text-white/40">m</kbd> mute
        {nextHref ? (
          <>
            {" "}
            · <kbd className="text-white/40">n</kbd> next
          </>
        ) : null}
      </p>
    </div>
  );
}
