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

/** A tap target that distinguishes single vs double tap. */
function TapZone({
  className,
  onSingle,
  onDouble,
  children,
}: {
  className: string;
  onSingle: () => void;
  onDouble: () => void;
  children?: React.ReactNode;
}) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handle = () => {
    const now = Date.now();
    if (now - last.current < 300) {
      if (timer.current) clearTimeout(timer.current);
      last.current = 0;
      onDouble();
    } else {
      last.current = now;
      timer.current = setTimeout(() => {
        last.current = 0;
        onSingle();
      }, 300);
    }
  };
  return (
    <button type="button" aria-hidden tabIndex={-1} className={className} onClick={handle}>
      {children}
    </button>
  );
}

const BUNNY_ORIGIN = "https://iframe.mediadelivery.net";

/**
 * The episode player.
 *
 * Bunny-hosted episodes render the Bunny Stream player directly (its own poster,
 * one play button, native fullscreen + touch controls). We talk to it over the
 * player.js postMessage protocol for autoplay-next and edge double-tap seeking.
 *
 * Mirror sources use a locked-down <video> with our own tap-to-play and
 * double-tap ±10s. Any playback error silently falls through to the next server.
 */
export function WatchPlayer({
  servers,
  poster,
  title,
  episodeLabel,
  nextHref,
  prevHref,
  bare,
}: {
  servers: Server[];
  poster?: string | null;
  title?: string;
  episodeLabel?: string;
  nextHref?: string | null;
  prevHref?: string | null;
  /** chrome-less: no ambient glow, no control strip (the /embed route) */
  bare?: boolean;
  /** reserved — VAST pre-roll is configured on the Bunny player itself */
  vastTag?: string | null;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false); // mirror pre-play gate only
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [menu, setMenu] = useState(false);
  const [seekFx, setSeekFx] = useState<null | "fwd" | "back">(null);
  // edge tap-zones only on touch — on desktop they'd swallow clicks meant for
  // the player's own settings / quality menus
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    try {
      setCoarse(window.matchMedia("(pointer: coarse)").matches);
    } catch {
      /* ignore */
    }
  }, []);

  const cur = servers[idx];
  const isBunny = cur?.type === "bunny";
  const isEmbed = cur?.type === "iframe";
  const isVideo = !!cur && (cur.type === "file" || cur.type === "hls");

  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  const nextRef = useRef(nextHref);
  useEffect(() => {
    nextRef.current = nextHref;
  }, [nextHref]);

  const pausedRef = useRef(true);
  const timeRef = useRef({ t: 0, d: 0 });
  const bunnySend = useRef<((m: string, v?: unknown) => void) | null>(null);

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
      const n = !v;
      try {
        localStorage.setItem("lh_autoplay", n ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!n) setCountdown(null);
      return n;
    });
  }, []);

  // reset the loading veil when the server changes
  useEffect(() => {
    setReady(false);
  }, [idx]);
  useEffect(() => {
    if (ready) return;
    if (!isBunny && !started) return;
    const t = setTimeout(() => setReady(true), 9000);
    return () => clearTimeout(t);
  }, [ready, isBunny, started, idx]);

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
    setReady(false);
    setIdx(i);
    setStarted(true);
  }, []);

  /* ── Bunny: player.js postMessage bridge (origin-checked, so it works through
        our /api/stream redirect) ── */
  useEffect(() => {
    if (!isBunny) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const send = (method: string, value?: unknown) => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ context: "player.js", version: "0.0.11", method, value }),
        BUNNY_ORIGIN,
      );
    };
    bunnySend.current = send;

    const onMsg = (e: MessageEvent) => {
      if (e.origin !== BUNNY_ORIGIN) return;
      let d: { context?: string; event?: string; value?: { seconds?: number; duration?: number } };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!d || d.context !== "player.js") return;
      switch (d.event) {
        case "ready":
          setReady(true);
          send("addEventListener", "play");
          send("addEventListener", "pause");
          send("addEventListener", "ended");
          send("addEventListener", "timeupdate");
          break;
        case "play":
          pausedRef.current = false;
          break;
        case "pause":
          pausedRef.current = true;
          break;
        case "timeupdate":
          if (d.value)
            timeRef.current = { t: d.value.seconds ?? 0, d: d.value.duration ?? 0 };
          break;
        case "ended":
          if (autoplayRef.current && nextRef.current) setCountdown(10);
          break;
      }
    };

    window.addEventListener("message", onMsg);
    // the child sends "ready" on its own load, but poll a few times in case we
    // attached late
    send("addEventListener", "ready");
    const ping = setInterval(() => send("addEventListener", "ready"), 1000);
    const stopPing = setTimeout(() => clearInterval(ping), 8000);

    return () => {
      window.removeEventListener("message", onMsg);
      clearInterval(ping);
      clearTimeout(stopPing);
      bunnySend.current = null;
    };
  }, [isBunny, idx]);

  const bunnySeek = useCallback((delta: number) => {
    const send = bunnySend.current;
    if (!send) return;
    const to = Math.max(0, (timeRef.current.t || 0) + delta);
    send("setCurrentTime", to);
    timeRef.current.t = to;
    setSeekFx(delta > 0 ? "fwd" : "back");
    setTimeout(() => setSeekFx(null), 550);
  }, []);
  const bunnyToggle = useCallback(() => {
    bunnySend.current?.(pausedRef.current ? "play" : "pause");
  }, []);

  /* ── mirror <video>: HLS attach ── */
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

  // kick the mirror <video> once it mounts (the click was the gesture)
  useEffect(() => {
    if (!started || !isVideo) return;
    videoRef.current?.play().catch(() => {});
  }, [started, idx, isVideo]);

  const videoSeek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + delta));
    setSeekFx(delta > 0 ? "fwd" : "back");
    setTimeout(() => setSeekFx(null), 550);
  };
  const videoToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const goFullscreen = useCallback(() => {
    const el = wrapRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      (el.requestFullscreen?.() as Promise<void> | undefined)?.catch(() => {});
      el.webkitRequestFullscreen?.();
    }
  }, []);

  // keyboard shortcuts (wrapper must have focus)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (isBunny) bunnyToggle();
          else if (v) v.paused ? v.play() : v.pause();
          break;
        case "ArrowRight":
          if (isBunny) bunnySeek(10);
          else if (v) v.currentTime += 10;
          break;
        case "ArrowLeft":
          if (isBunny) bunnySeek(-10);
          else if (v) v.currentTime -= 10;
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
          goFullscreen();
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
  }, [isBunny, bunnyToggle, bunnySeek, goFullscreen, nextHref, prevHref, router]);

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
    "relative aspect-video w-full overflow-hidden bg-black shadow-card outline-none ring-1 ring-white/10 focus-visible:ring-accent/60 sm:rounded-2xl";

  if (!cur || dead) {
    return (
      <div className={frame}>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-white/60">Can&apos;t play this episode right now.</p>
            {servers.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {servers.map((sv, i) => (
                  <button
                    key={sv.key}
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

  const seekBadge = seekFx && (
    <span className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">
        {seekFx === "fwd" ? "⏩ +10s" : "⏪ −10s"}
      </span>
    </span>
  );

  return (
    <div className="relative">
      {/* ambient glow */}
      {poster && !bare && (
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
        className={`group ${frame}`}
      >
        {isBunny ? (
          <>
            <iframe
              ref={iframeRef}
              key={cur.key}
              src={cur.src}
              title="Video player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; clipboard-write"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setReady(true)}
              className="absolute inset-0 h-full w-full border-0"
            />
            {/* edge double-tap zones (touch only) — clear of Bunny's centre play
                button and its bottom control bar */}
            {coarse && (
              <>
                <TapZone
                  className="absolute bottom-[24%] left-0 top-[14%] z-10 w-[22%] cursor-default"
                  onSingle={bunnyToggle}
                  onDouble={() => bunnySeek(-10)}
                />
                <TapZone
                  className="absolute bottom-[24%] right-0 top-[14%] z-10 w-[22%] cursor-default"
                  onSingle={bunnyToggle}
                  onDouble={() => bunnySeek(10)}
                />
              </>
            )}
            {seekBadge}
            {!ready && <Spinner label="Loading…" />}
          </>
        ) : !started ? (
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
          </button>
        ) : isEmbed ? (
          <>
            <iframe
              key={cur.key}
              src={cur.src}
              title="Video player"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setReady(true)}
              className="absolute inset-0 h-full w-full border-0"
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
              className="absolute inset-0 h-full w-full bg-black"
            />
            {/* tap-to-toggle + double-tap seek (touch only), clear of the
                native control bar */}
            {coarse && (
              <>
                <TapZone
                  className="absolute bottom-[16%] left-0 top-0 z-10 w-[32%] cursor-default"
                  onSingle={videoToggle}
                  onDouble={() => videoSeek(-10)}
                />
                <TapZone
                  className="absolute bottom-[16%] right-0 top-0 z-10 w-[32%] cursor-default"
                  onSingle={videoToggle}
                  onDouble={() => videoSeek(10)}
                />
              </>
            )}
            {seekBadge}
            {!ready && <Spinner label="Loading…" />}
          </>
        )}

        {countdown != null && nextHref && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/75 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-sm text-white/60">Next episode in</p>
              <p className="my-1 font-display text-6xl font-extrabold tabular-nums text-white">
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

      {/* control strip — always visible, touch-friendly */}
      {bare ? null : (
      <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs">
        <button
          onClick={goFullscreen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium text-white/70 transition hover:border-accent/40 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          Fullscreen
        </button>

        {nextHref && (
          <button
            onClick={toggleAutoplay}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition ${
              autoplay
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-line bg-surface text-white/55 hover:text-white"
            }`}
          >
            <span
              className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                autoplay ? "border-accent bg-accent" : "border-white/30"
              }`}
            >
              {autoplay && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            Autoplay next
          </button>
        )}

        {servers.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium text-white/70 transition hover:border-accent/40 hover:text-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Server {idx + 1}
              <span className="text-white/30">▾</span>
            </button>
            {menu && (
              <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-white/10 bg-black/95 p-1 backdrop-blur-md">
                {servers.map((sv, i) => (
                  <button
                    key={sv.key}
                    onClick={() => pickServer(i)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition ${
                      i === idx
                        ? "bg-accent/20 text-white"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>Server {i + 1}</span>
                    {sv.quality && <span className="text-[10px] text-white/40">{sv.quality}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="ml-auto hidden text-[11px] text-white/25 sm:inline">
          double-tap the sides to skip · <kbd>f</kbd> fullscreen
          {nextHref ? (
            <>
              {" "}
              · <kbd>n</kbd> next
            </>
          ) : null}
        </span>
      </div>
      )}
    </div>
  );
}
