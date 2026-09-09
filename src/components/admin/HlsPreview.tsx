"use client";

import { useEffect, useRef, useState } from "react";

const CDN = process.env.NEXT_PUBLIC_BUNNY_CDN_HOST;

/** Minimal HLS preview for the review queue. Plays straight off the Bunny CDN —
 *  works because /admin is served from the whitelisted domain. */
export function HlsPreview({ guid, ready }: { guid: string; ready: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open || !CDN) return;
    const video = ref.current;
    if (!video) return;
    const src = `https://${CDN}/${guid}/playlist.m3u8`;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let dead = false;
    import("hls.js").then(({ default: HlsJs }) => {
      if (dead || !HlsJs.isSupported()) {
        video.src = src;
        return;
      }
      hls = new HlsJs();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => {
      dead = true;
      hls?.destroy();
    };
  }, [open, guid]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!ready}
        className="rounded-lg border border-white/15 bg-white/[0.03] px-2.5 py-1 text-xs text-white/75 hover:border-white/30 disabled:opacity-40"
      >
        {ready ? "▶ preview" : "encoding…"}
      </button>
    );
  }
  return (
    <video
      ref={ref}
      controls
      playsInline
      className="aspect-video w-full max-w-md rounded-lg bg-black"
    />
  );
}
