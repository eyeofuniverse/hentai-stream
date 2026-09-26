"use client";

import { useEffect, useRef, useState } from "react";
import { useAdblock } from "@/components/ads/AdblockProvider";
import { rewriteForAdblock } from "@/lib/adblock-rewrite";
import { fillMacros, offsetToSec, ping, resolveVast, type MacroValues, type ResolvedAd } from "@/lib/vast-client";

type VastConfig = { tags: string[]; capMinutes: number; skipAfterSec: number };

/** never sat on a black frame longer than this waiting for the ad to start */
const START_TIMEOUT_MS = 8000;

/**
 * Our own VAST pre-roll. The tag is resolved in the viewer's browser (see
 * lib/vast-client.ts for why) and every pixel the VAST chain asks for is fired
 * from here — including the ones on ExoClick's wrapper, which is where the
 * paid events live: the Video Impression when playback starts, and the Video
 * View after 10 seconds of real playback (a `progress` tracking event).
 * Renders nothing and calls onDone immediately when there's no ad, so a
 * no-fill never delays real content.
 *
 * `src`/`muted` are set imperatively on the element inside the effect below,
 * never as JSX props — this component re-renders on every timeupdate (the
 * skip countdown), and a React-controlled `src` on a <video> that re-renders
 * that often risks the browser re-evaluating/reloading it mid-playback. The
 * HLS attach code elsewhere in WatchPlayer.tsx uses the same imperative
 * pattern for the same reason.
 */
export function PreRollAd({ onDone }: { onDone: () => void }) {
  const [ad, setAd] = useState<ResolvedAd | null | undefined>(undefined); // undefined = resolving
  const [showUnmute, setShowUnmute] = useState(false);
  const [skipIn, setSkipIn] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const doneRef = useRef(false);
  const apiRef = useRef<{ skip: () => void; click: () => void } | null>(null);

  const adblock = useAdblock();
  const rewriteRef = useRef<(u: string) => string>((u) => u);
  rewriteRef.current =
    adblock.detected && adblock.domain
      ? (u) => rewriteForAdblock(u, adblock.domain as string)
      : (u) => u;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // config → frequency cap → resolve the VAST chain in the browser
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cfg: VastConfig = { tags: [], capMinutes: 30, skipAfterSec: 0 };
      try {
        const r = await fetch("/api/ads/vast");
        if (r.ok) cfg = { ...cfg, ...(await r.json()) };
      } catch {
        /* no config → no ad */
      }
      if (cancelled) return;

      // cap is checked BEFORE any ad request, so a capped viewer never costs
      // the ad server a call it can't monetize
      let lastShown = 0;
      try {
        lastShown = Number(localStorage.getItem("lh_vast_last") ?? "0");
      } catch {
        /* ignore */
      }
      const capped = cfg.capMinutes > 0 && Date.now() - lastShown < cfg.capMinutes * 60_000;
      if (capped || !Array.isArray(cfg.tags) || !cfg.tags.length) {
        setAd(null);
        finish();
        return;
      }

      const resolved = await resolveVast(cfg.tags, { rewrite: rewriteRef.current }).catch(() => null);
      if (cancelled) return;
      if (!resolved) {
        setAd(null);
        finish();
        return;
      }

      // admin override wins over the ad's own skipoffset; 0/unset = trust the ad
      const skipOffsetSec = cfg.skipAfterSec > 0 ? cfg.skipAfterSec : (resolved.skipOffsetSec ?? 5);
      setAd({ ...resolved, skipOffsetSec });
      setSkipIn(skipOffsetSec);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // play the resolved ad exactly once, firing the VAST pixels at the right
  // moments — everything imperative on purpose (see the doc comment above)
  useEffect(() => {
    if (!ad) return;
    const video = videoRef.current;
    if (!video) return;

    const rewrite = rewriteRef.current;
    const fired = firedRef.current;

    const send = (url: string, m: MacroValues = {}) =>
      ping(rewrite(fillMacros(url, { assetUri: ad.mediaUrl, playheadSec: video.currentTime || 0, ...m })));
    const once = (key: string, url: string) => {
      if (fired.has(key)) return;
      fired.add(key);
      send(url);
    };
    const eventOnce = (name: string) =>
      ad.tracking.filter((t) => t.event === name).forEach((t) => once(`${name}|${t.offset}|${t.url}`, t.url));
    const eventEvery = (name: string) =>
      ad.tracking.filter((t) => t.event === name).forEach((t) => send(t.url));

    let started = false;
    let paused = false;
    let prevMuted = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let startTimer: ReturnType<typeof setTimeout> | undefined;

    const fail = (code: number) => {
      ad.errors.forEach((u) => send(u, { errorCode: code }));
      finish();
    };

    // Hard ceiling so a stalled creative (buffers forever without ever firing
    // `error` or `ended`) can't strand the viewer on the ad screen. Sized to
    // the ad's own length plus slack for buffering. Re-armed on every
    // pause/resume — a viewer deliberately pausing isn't a stall.
    const maxWaitMs = (ad.durationSec ? ad.durationSec + 10 : 25) * 1000;
    const armStall = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => fail(402), maxWaitMs);
    };

    // ExoClick's "Video Impression" is the play event: fire the impression
    // pixels of every hop (wrapper + inline) the moment playback really starts
    const onPlaying = () => {
      if (started) return;
      started = true;
      clearTimeout(startTimer);
      prevMuted = video.muted;
      ad.impressions.forEach((u) => once(`imp|${u}`, u));
      eventOnce("creativeView");
      eventOnce("impression");
      eventOnce("start");
      try {
        localStorage.setItem("lh_vast_last", String(Date.now()));
      } catch {
        /* ignore */
      }
    };

    const onTimeUpdate = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : (ad.durationSec ?? 0);
      const t = video.currentTime;
      if (started && dur) {
        const frac = t / dur;
        if (frac >= 0.25) eventOnce("firstQuartile");
        if (frac >= 0.5) eventOnce("midpoint");
        if (frac >= 0.75) eventOnce("thirdQuartile");
      }
      if (started) {
        // ExoClick's paid "Video View" = a `progress` event at 10s of playback
        for (const tr of ad.tracking) {
          if (tr.event !== "progress") continue;
          const at = offsetToSec(tr.offset, dur || null);
          if (at != null && t >= at) once(`progress|${tr.offset}|${tr.url}`, tr.url);
        }
      }
      setSkipIn(Math.max(0, Math.ceil((ad.skipOffsetSec ?? 0) - t)));
    };

    const onPause = () => {
      clearTimeout(stallTimer);
      if (started && !video.ended) {
        paused = true;
        eventEvery("pause");
      }
    };
    const onPlay = () => {
      armStall();
      if (started && paused) {
        paused = false;
        eventEvery("resume");
      }
    };
    const onVolume = () => {
      if (!started || video.muted === prevMuted) return;
      prevMuted = video.muted;
      eventEvery(video.muted ? "mute" : "unmute");
    };
    const onEnded = () => {
      eventOnce("complete");
      finish();
    };
    const onError = () => fail(405);

    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    apiRef.current = {
      skip: () => {
        eventOnce("skip");
        finish();
      },
      click: () => {
        ad.clickTracking.forEach((u) => send(u));
        if (ad.clickThrough) window.open(fillMacros(ad.clickThrough), "_blank", "noopener,noreferrer");
      },
    };

    video.src = ad.mediaUrl;
    armStall();
    startTimer = setTimeout(() => {
      if (!started) fail(405);
    }, START_TIMEOUT_MS);
    video.play().catch(() => {
      // autoplay-with-sound blocked — fall back to muted autoplay
      video.muted = true;
      setShowUnmute(true);
      video.play().catch(() => fail(400));
    });

    return () => {
      clearTimeout(stallTimer);
      clearTimeout(startTimer);
      apiRef.current = null;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad]);

  if (ad === undefined) {
    // resolving the VAST chain in the browser — keep the dark frame (no flash
    // of content) with a small spinner so it doesn't read as a hang
    return (
      <div className="absolute inset-0 grid place-items-center bg-black">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
      </div>
    );
  }
  if (!ad) return null; // finish() already called

  const skippable = skipIn != null && skipIn <= 0;

  // ExoClick's publisher guidelines: "the video ad should stop when clicked
  // and resume when clicked again" — the metric that pays is watch-through
  // (the 10s view), not click, so the video surface toggles play/pause rather
  // than firing the click-through. Genuine click-through still exists as its
  // own small CTA, so tapping to pause never launches the landing page.
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        playsInline
        onClick={handleVideoClick}
        className="h-full w-full cursor-pointer object-contain"
      />

      <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
        Advertisement
      </span>

      {ad.clickThrough && (
        <button
          type="button"
          onClick={() => apiRef.current?.click()}
          className="absolute right-3 top-3 rounded bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white/85 hover:bg-black/85"
        >
          Learn more ↗
        </button>
      )}

      {showUnmute && (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (v) v.muted = false;
            setShowUnmute(false);
          }}
          className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-black/85"
        >
          🔇 Tap to unmute
        </button>
      )}

      <button
        type="button"
        onClick={skippable ? () => apiRef.current?.skip() : undefined}
        disabled={!skippable}
        className={`absolute bottom-3 right-3 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          skippable
            ? "bg-accent text-white hover:bg-accent-2"
            : "cursor-default bg-black/70 text-white/60"
        }`}
      >
        {skippable ? "Skip Ad ▶" : `Skip in ${skipIn}s`}
      </button>
    </div>
  );
}
