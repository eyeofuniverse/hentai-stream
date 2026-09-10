import type { CSSProperties } from "react";

/**
 * A reserved advertising slot. It renders a fixed-size container (so a real ad
 * loading in later causes no layout shift) tagged with `data-ad-slot` for
 * whatever network we wire up.
 *
 * Behaviour is controlled by NEXT_PUBLIC_ADS:
 *   unset / "off"    → nothing renders (current state)
 *   "placeholder"    → a labelled empty box, for laying things out / demoing
 *   "live"           → the empty container only; the network script fills it
 */
type Format = "rect" | "half" | "leaderboard" | "inline";

const DIMS: Record<Format, { w: number; h: number }> = {
  rect: { w: 300, h: 250 },
  half: { w: 300, h: 600 },
  leaderboard: { w: 728, h: 90 },
  inline: { w: 468, h: 60 },
};

const MODE = process.env.NEXT_PUBLIC_ADS ?? "off";

export function AdSlot({
  id,
  format = "rect",
  className = "",
}: {
  id: string;
  format?: Format;
  className?: string;
}) {
  if (MODE === "off") return null;

  const d = DIMS[format];
  const style: CSSProperties = {
    width: d.w,
    height: d.h,
    maxWidth: "100%",
  };

  return (
    <div
      data-ad-slot={id}
      data-ad-format={format}
      aria-hidden="true"
      style={style}
      className={`mx-auto flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] ${className}`}
    >
      {MODE === "placeholder" && (
        <span className="select-none text-[10px] font-medium uppercase tracking-[0.2em] text-white/20">
          Ad · {d.w}×{d.h}
        </span>
      )}
    </div>
  );
}
