"use client";

import { useEffect, useRef, useState } from "react";

type ResolvedAd = {
  mediaUrl: string;
  durationSec: number | null;
  skipOffsetSec: number | null;
  trackingEvents: { event: string; url: string; atFraction: number | null }[];
  impressionPixels: string[];
  errorPixels: string[];
  clickThrough: string | null;
  clickTracking: string[];
};

/** Fire-and-forget tracking beacon — never blocks or throws on the caller. */
function ping(url: string) {
  try {
    fetch(url, { mode: "no-cors", keepalive: true, cache: "no-store" }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Our own VAST pre-roll — replaces Bunny's built-in VAST integration so we
 * can waterfall across multiple tags and theme it to match the site. Resolves
 * server-side via /api/ads/vast; renders nothing and calls onDone
 * immediately if no ad is available, so a no-fill never delays real content.
 *
 * `src`/`muted` are set imperatively on the element inside the effect below,
 * never as JSX props — this component re-renders on every timeupdate (the
 * skip countdown), and a React-controlled `src` on a <video> that re-renders
 * that often risks the browser re-evaluating/reloading it mid-playback. The
 * HLS attach code elsewhere in WatchPlayer.tsx uses the same imperative
 * pattern for the same reason.
 */
export function PreRollAd({ onDone }: { onDone: () => void }) {
  const [ad, setAd] = useState<ResolvedAd | null | undefined>(undefined); // undefined = loading
  const [showUnmute, setShowUnmute] = useState(false);
  const [skipIn, setSkipIn] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads/vast")
      .then((r) => (r.ok ? r.json() : { ad: null, capMinutes: 30 }))
      .then((d) => {
        if (cancelled) return;
        const capMinutes = typeof d.capMinutes === "number" ? d.capMinutes : 30;
        let lastShown = 0;
        try {
          lastShown = Number(localStorage.getItem("lh_vast_last") ?? "0");
        } catch {
          /* ignore */
        }
        const capped = capMinutes > 0 && Date.now() - lastShown < capMinutes * 60_000;
        if (!d.ad || capped) {
          setAd(null);
          finish();
          return;
        }
        try {
          localStorage.setItem("lh_vast_last", String(Date.now()));
        } catch {
          /* ignore */
        }
        setAd(d.ad);
        setSkipIn(d.ad.skipOffsetSec ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setAd(null);
          finish();
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mount + play the ad exactly once per resolved ad — everything here is
  // imperative on purpose (see the component doc comment above)
  useEffect(() => {
    if (!ad) return;
    const video = videoRef.current;
    if (!video) return;

    video.src = ad.mediaUrl;
    video.play().catch(() => {
      // autoplay-with-sound blocked — fall back to muted autoplay
      video.muted = true;
      setShowUnmute(true);
      video.play().catch(() => {
        finish();
      });
    });

    ad.impressionPixels.forEach(ping);

    // Hard ceiling so a stalled creative (buffers forever without ever firing
    // `error` or `ended` — a real, observed failure mode with some ad
    // networks) can't strand the viewer on the ad screen indefinitely. Sized
    // to the ad's own declared length when we have one, plus slack for normal
    // buffering; a generous flat cap otherwise. Counts as a failure, same as
    // a real error, so the ad network still sees it wasn't a real view.
    const maxWaitMs = (ad.durationSec ? ad.durationSec + 10 : 25) * 1000;
    const stallTimer = setTimeout(() => {
      ad.errorPixels.forEach((u) => ping(u.replace("[ERRORCODE]", "402")));
      finish();
    }, maxWaitMs);

    const onTimeUpdate = () => {
      const duration = video.duration || ad.durationSec || 0;
      if (!duration) return;
      const frac = video.currentTime / duration;
      for (const t of ad.trackingEvents) {
        if (t.event === "skip" || t.atFraction == null) continue;
        const key = `${t.event}:${t.url}`;
        if (frac >= t.atFraction && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          ping(t.url);
        }
      }
      setSkipIn(Math.max(0, Math.ceil((ad.skipOffsetSec ?? 0) - video.currentTime)));
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      clearTimeout(stallTimer);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad]);

  if (ad === undefined) {
    // brief resolve window — keep the existing dark frame, no flash of content
    return <div className="absolute inset-0 bg-black" />;
  }
  if (!ad) return null; // finish() already called

  const skippable = skipIn != null && skipIn <= 0;

  // ExoClick's publisher guidelines: "the video ad should stop when clicked
  // and resume when clicked again" — a real, separately-reported metric is
  // watch-through (views/quartiles), not click, so the main video surface
  // toggles play/pause rather than firing the click-through. Genuine
  // click-through still exists, just as its own small CTA below, so tapping
  // to pause never accidentally launches the advertiser's landing page.
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const handleCtaClick = () => {
    if (!ad.clickThrough) return;
    ad.clickTracking.forEach(ping);
    window.open(ad.clickThrough, "_blank", "noopener,noreferrer");
  };

  const handleSkip = () => {
    const skipPixel = ad.trackingEvents.find((t) => t.event === "skip")?.url;
    if (skipPixel) ping(skipPixel);
    finish();
  };

  const handleError = () => {
    ad.errorPixels.forEach((u) => ping(u.replace("[ERRORCODE]", "405")));
    finish();
  };

  const handleEnded = () => {
    const completePixel = ad.trackingEvents.find((t) => t.event === "complete")?.url;
    if (completePixel && !firedRef.current.has(`complete:${completePixel}`)) ping(completePixel);
    finish();
  };

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        playsInline
        onClick={handleVideoClick}
        onEnded={handleEnded}
        onError={handleError}
        className="h-full w-full cursor-pointer object-contain"
      />

      <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
        Advertisement
      </span>

      {ad.clickThrough && (
        <button
          type="button"
          onClick={handleCtaClick}
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
        onClick={skippable ? handleSkip : undefined}
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
