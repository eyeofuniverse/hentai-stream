"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Server } from "@/lib/stream";
import { gradientFor } from "@/lib/gradient";

function Spinner() {
  return (
    <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/30">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
    </span>
  );
}

const BUNNY_ORIGIN = "https://iframe.mediadelivery.net";

/**
 * The episode player.
 *
 * Bunny-hosted episodes ARE the Bunny Stream player — all UI, controls,
 * fullscreen, resume, speed etc. are configured in the Bunny dashboard, not
 * here. We only add what the player can't know about: advancing to the next
 * episode, silent failover to a mirror, and sizing the frame to the video.
 *
 * Mirror sources use a bare locked-down <video>.
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false); // mirror pre-play gate only
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  const cur = servers[idx];
  const isBunny = cur?.type === "bunny";
  const isEmbed = cur?.type === "iframe";
  const isVideo = !!cur && (cur.type === "file" || cur.type === "hls");

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
  }, [idx]);
  useEffect(() => {
    if (ready || (!isBunny && !started)) return;
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
    setReady(false);
    setIdx(i);
    setStarted(true);
  }, []);

  /* ── Bunny: player.js postMessage bridge — only for "ended" → next episode.
        Origin-checked, so it works through the /api/stream redirect. ── */
  useEffect(() => {
    if (!isBunny) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const send = (method: string, value?: unknown) =>
      iframe.contentWindow?.postMessage(
        JSON.stringify({ context: "player.js", version: "0.0.11", method, value }),
        BUNNY_ORIGIN,
      );

    const onMsg = (e: MessageEvent) => {
      if (e.origin !== BUNNY_ORIGIN) return;
      let d: { context?: string; event?: string };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!d || d.context !== "player.js") return;
      if (d.event === "ready") {
        setReady(true);
        send("addEventListener", "ended");
      } else if (d.event === "ended") {
        if (autoplayRef.current && nextRef.current) setCountdown(10);
      }
    };

    window.addEventListener("message", onMsg);
    send("addEventListener", "ready");
    const ping = setInterval(() => send("addEventListener", "ready"), 1000);
    const stop = setTimeout(() => clearInterval(ping), 8000);
    return () => {
      window.removeEventListener("message", onMsg);
      clearInterval(ping);
      clearTimeout(stop);
    };
  }, [isBunny, idx]);

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

  useEffect(() => {
    if (!started || !isVideo) return;
    videoRef.current?.play().catch(() => {});
  }, [started, idx, isVideo]);

  const play = useCallback(() => {
    setStarted(true);
    setCountdown(null);
  }, []);

  // keyboard: only the bits the Bunny player can't cover from the parent
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
            <p className="mt-3 text-xs text-white/30">
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
      className={`group ${frame}`}
      style={frameStyle}
    >
      {isBunny || isEmbed ? (
        <>
          <iframe
            ref={isBunny ? iframeRef : undefined}
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
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onLoadedData={() => setReady(true)}
            onCanPlay={() => setReady(true)}
            onError={failover}
            onEnded={() => {
              if (autoplayRef.current && nextHref) setCountdown(10);
            }}
            className="absolute inset-0 h-full w-full bg-black"
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
              className="mt-3 text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
            >
              Turn off autoplay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
