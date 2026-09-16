"use client";

import "plyr/dist/plyr.css";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Server } from "@/lib/stream";
import { gradientFor } from "@/lib/gradient";
import { PreRollAd } from "@/components/ads/PreRollAd";

function Spinner() {
  return (
    <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/30">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
    </span>
  );
}

/**
 * The episode player.
 *
 * Our own Bunny-hosted copy and any HLS mirror both play through the same
 * <video> + hls.js + Plyr setup below (skinned to one consistent look).
 * Only sources that are inherently a third-party player page (type
 * "iframe" — a site that never gave us a direct/embeddable file) fall back
 * to a real <iframe>.
 */
export function WatchPlayer({
  servers,
  poster,
  title,
  nextHref,
  prevHref,
  bare,
}: {
  servers: Server[];
  poster?: string | null;
  title?: string;
  nextHref?: string | null;
  prevHref?: string | null;
  /** chrome-less: the /embed route */
  bare?: boolean;
  /** reserved — VAST pre-roll is configured on the Bunny player itself */
  vastTag?: string | null;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<import("plyr").default | null>(null);

  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false); // user clicked play
  const [adDone, setAdDone] = useState(false); // pre-roll finished/skipped/none-to-show
  const [ready, setReady] = useState(false);
  const [showUnmute, setShowUnmute] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ dir: "back" | "fwd"; key: number } | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = servers[idx];
  const isEmbed = cur?.type === "iframe";
  const isVideo = !!cur && (cur.type === "file" || cur.type === "hls");
  // gates the REAL player (iframe or video) — the pre-roll, if any, sits
  // between the play click and this becoming true
  const showPlayer = started && adDone;

  const autoplayRef = useRef(true);
  const nextRef = useRef(nextHref);
  useEffect(() => {
    nextRef.current = nextHref;
  }, [nextHref]);
  useEffect(() => {
    try {
      autoplayRef.current = localStorage.getItem("lh_autoplay") !== "0";
    } catch {
      /* ignore */
    }
  }, []);
  const stopAutoplay = () => {
    autoplayRef.current = false;
    try {
      localStorage.setItem("lh_autoplay", "0");
    } catch {
      /* ignore */
    }
    setCountdown(null);
  };

  // fit the frame to the real video aspect ratio (old OVAs are 4:3) — read it
  // off the poster, which Bunny/Cloudinary generate at the native ratio
  useEffect(() => {
    if (!poster) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const r = img.naturalWidth / img.naturalHeight;
        if (r > 0.9 && r < 2.6) setRatio(r);
      }
    };
    img.src = poster;
  }, [poster]);

  useEffect(() => {
    setReady(false);
    setShowUnmute(false);
  }, [idx]);
  useEffect(() => {
    if (ready || !showPlayer) return;
    const t = setTimeout(() => setReady(true), 9000);
    return () => clearTimeout(t);
  }, [ready, showPlayer, idx]);

  const failover = useCallback(() => {
    setIdx((i) => {
      if (i + 1 < servers.length) return i + 1;
      setDead(true);
      return i;
    });
  }, [servers.length]);

  const pickServer = useCallback((i: number) => {
    setDead(false);
    setReady(false);
    setIdx(i);
    setStarted(true);
  }, []);

  /* ── <video>: HLS attach (our own Bunny copy or an HLS mirror) — starts
        as soon as the user clicks play, not once the pre-roll ad finishes.
        The <video> element itself is mounted (hidden) the whole time the ad
        is showing (see the render below) specifically so this can buffer
        the real episode in the background — video stays paused throughout,
        so playback position never advances during the ad; only the actual
        .play() call below is gated on the ad being done. Without this, nothing
        about the real video even began loading until the ad ended, which is
        why it used to visibly stall right when playback should start. ── */
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

  /* ── <video>: Plyr skin — also as soon as started, so there's no flash of
        native controls the moment the ad ends and the video is revealed.
        Plyr's full default control set (play, progress, time, mute+volume
        slider, captions, settings, pip, airplay, fullscreen) is a desktop
        toolbar — on a ~360-400px phone it crams so many fixed-width buttons
        into the bar that the progress/seek scrubber (the one thing that
        needs to flex-grow) gets squeezed to a sliver, while the volume
        slider — a fixed, wider element — visually dominates instead. Below
        the `sm` breakpoint only, trim to what actually fits: drop the
        separate volume slider (keep the mute toggle), captions (unused —
        this content is hardsubbed, no real text tracks) and settings/pip/
        airplay, so the seek bar gets the room it needs. Desktop is
        untouched — same full control set as before. ── */
  useEffect(() => {
    if (!started || !isVideo) return;
    const video = videoRef.current;
    if (!video) return;
    let killed = false;
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 639.98px)").matches;
    import("plyr").then(({ default: Plyr }) => {
      if (killed || !videoRef.current) return;
      plyrRef.current = new Plyr(videoRef.current, {
        // our own keydown handler (n/p/f) already covers this; avoid double-handling
        keyboard: { focused: false, global: false },
        tooltips: { controls: false, seek: true },
        ...(isMobile
          ? { controls: ["play-large", "play", "progress", "current-time", "mute", "fullscreen"] }
          : {}),
      });
    });
    return () => {
      killed = true;
      plyrRef.current?.destroy();
      plyrRef.current = null;
    };
  }, [started, isVideo, cur?.key]);

  // double-tap left/right half of the video to seek -10s/+10s — a standard
  // mobile gesture Plyr doesn't provide out of the box. Desktop-only via
  // hover isn't relevant here; this is gated to mobile viewports purely by
  // CSS (`sm:hidden` on the zones below), same as the trimmed control set.
  const handleZoneTap = useCallback((side: "left" | "right") => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.side === side && now - last.time < 350) {
      // confirmed double-tap — cancel the pending single-tap (toggle-play) action
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTapRef.current = null;
      const video = videoRef.current;
      if (video) {
        const dur = Number.isFinite(video.duration) ? video.duration : Infinity;
        video.currentTime = Math.max(0, Math.min(dur, video.currentTime + (side === "left" ? -10 : 10)));
      }
      setSeekFlash({ dir: side === "left" ? "back" : "fwd", key: now });
    } else {
      lastTapRef.current = { time: now, side };
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      // give it a moment in case a second tap is coming; otherwise treat it
      // as a plain tap — same as tapping the video itself would do
      singleTapTimer.current = setTimeout(() => {
        lastTapRef.current = null;
        plyrRef.current?.togglePlay();
      }, 300);
    }
  }, []);

  // actually START playback — gated on the ad being done (unlike the attach
  // effects above, which run the moment the user clicks play). By now the
  // video has had the whole ad duration to buffer, so this plays instantly
  // instead of visibly stalling to load. Try unmuted first since this is
  // usually still within the browser's "recent user gesture" window (the
  // skip-ad click, or the ad ending right after one); if that's blocked,
  // fall back to muted autoplay + a tap-to-unmute prompt, same pattern as
  // the pre-roll ad itself.
  useEffect(() => {
    if (!showPlayer || !isVideo) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      video.muted = true;
      setShowUnmute(true);
      video.play().catch(() => {});
    });
  }, [showPlayer, idx, isVideo]);

  useEffect(() => {
    if (!seekFlash) return;
    const t = setTimeout(() => setSeekFlash(null), 550);
    return () => clearTimeout(t);
  }, [seekFlash]);

  const play = useCallback(() => {
    setStarted(true);
    setCountdown(null);
  }, []);

  const handleAdDone = useCallback(() => {
    setAdDone(true);
  }, []);

  // keyboard: n/p/f — Plyr's own shortcuts are disabled above to avoid double-handling
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" && nextHref) router.push(nextHref);
      else if (e.key === "p" && prevHref) router.push(prevHref);
      else if (e.key === "f") {
        const box = wrapRef.current as
          | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
          | null;
        if (!box) return;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else {
          (box.requestFullscreen?.() as Promise<void> | undefined)?.catch(() => {});
          box.webkitRequestFullscreen?.();
        }
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
    "relative w-full overflow-hidden bg-black shadow-card outline-none ring-1 ring-white/10 focus-visible:ring-accent/60 sm:rounded-2xl";
  const frameStyle = { aspectRatio: String(ratio ?? 16 / 9) };
  const iframeAllow =
    "autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; accelerometer *; gyroscope *; clipboard-write *";

  if (!cur || dead) {
    return (
      <div className={frame} style={frameStyle}>
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
            <p className="mt-3 text-xs text-white/50">
              Or check back shortly — mirrors refresh automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
      className={`lh-plyr group ${frame}`}
      style={frameStyle}
    >
      {!started && (
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
              className="h-full w-full object-cover opacity-60 transition group-hover:opacity-75"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-glow transition group-hover:scale-110 sm:h-20 sm:w-20">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}

      {started && isVideo && (
        <>
          <video
            ref={videoRef}
            key={cur.key}
            src={cur.type === "file" ? cur.src : undefined}
            poster={poster ?? undefined}
            controls
            playsInline
            preload="auto"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onLoadedData={() => setReady(true)}
            onCanPlay={() => setReady(true)}
            onError={failover}
            onEnded={() => {
              window.dispatchEvent(new CustomEvent("lh:episode-ended"));
              if (autoplayRef.current && nextHref) setCountdown(10);
            }}
            className={`absolute inset-0 h-full w-full bg-black ${adDone ? "" : "invisible"}`}
          />
          {/* Plyr shows its own themed loading spinner once revealed — an
              overlay Spinner here would double up with it. */}

          {/* Mobile-only (sm:hidden) double-tap-to-seek gesture, since Plyr
              has no built-in equivalent. Stops short of the bottom control
              bar so the real controls stay reachable. A single tap mimics
              Plyr's own tap-to-toggle-play so nothing feels dead if it
              doesn't land as a double-tap. */}
          {adDone && (
            <div className="absolute inset-x-0 top-0 bottom-14 z-20 flex sm:hidden">
              <button
                type="button"
                aria-label="Tap twice to rewind 10 seconds"
                onClick={() => handleZoneTap("left")}
                className="relative h-full flex-1"
              >
                {seekFlash?.dir === "back" && (
                  <span
                    key={seekFlash.key}
                    className="absolute inset-0 grid animate-fadein place-items-center"
                  >
                    <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
                      ⏪ 10s
                    </span>
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Tap twice to fast-forward 10 seconds"
                onClick={() => handleZoneTap("right")}
                className="relative h-full flex-1"
              >
                {seekFlash?.dir === "fwd" && (
                  <span
                    key={seekFlash.key}
                    className="absolute inset-0 grid animate-fadein place-items-center"
                  >
                    <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
                      10s ⏩
                    </span>
                  </span>
                )}
              </button>
            </div>
          )}

          {adDone && showUnmute && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (v) v.muted = false;
                setShowUnmute(false);
              }}
              className="absolute bottom-3 left-3 z-30 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-black/85"
            >
              🔇 Tap to unmute
            </button>
          )}
        </>
      )}

      {started && !adDone && <PreRollAd onDone={handleAdDone} />}

      {started && adDone && isEmbed && (
        <>
          <iframe
            key={cur.key}
            src={cur.src}
            title={title ? `${title} — player` : "Video player"}
            allow={iframeAllow}
            allowFullScreen
            referrerPolicy="no-referrer"
            onLoad={() => setReady(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
          {!ready && <Spinner />}
        </>
      )}

      {countdown != null && nextHref && !bare && (
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
            <button
              onClick={stopAutoplay}
              className="mt-3 text-xs text-white/50 underline-offset-2 hover:text-white/70 hover:underline"
            >
              Turn off autoplay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
