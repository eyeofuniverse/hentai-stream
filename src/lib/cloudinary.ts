const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Build a Cloudinary delivery URL.
 *   - stored value is a public id  -> upload delivery
 *   - stored value is already https -> returned as-is (MAL images, dev)
 */
export function img(
  stored: string | null | undefined,
  opts: { w?: number; h?: number; ar?: string } = {},
): string | null {
  if (!stored) return null;
  if (stored.startsWith("http")) return stored;
  if (!CLOUD) return null;

  const t = [
    "f_auto",
    "q_auto",
    opts.w && `w_${opts.w}`,
    opts.h && `h_${opts.h}`,
    opts.ar && `ar_${opts.ar}`,
    (opts.w || opts.h) && "c_fill",
    "g_auto",
  ]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${CLOUD}/image/upload/${t}/${stored}`;
}

/** Responsive srcset across a few widths at a fixed aspect ratio. Returns null
 *  for MAL/full-URL images (can't resize those) so the caller falls back to a
 *  plain src. */
export function srcSet(
  stored: string | null | undefined,
  widths: number[],
  ar: string,
): string | null {
  if (!stored || stored.startsWith("http") || !CLOUD) return null;
  return widths
    .map((w) => `${img(stored, { w, ar })} ${w}w`)
    .join(", ");
}

/* ── portrait cover (series) ── */
export const cover = (id?: string | null) => img(id, { w: 300, ar: "2:3" });
export const coverSet = (id?: string | null) =>
  srcSet(id, [160, 220, 300, 400, 500], "2:3");
export const COVER_SIZES = "(max-width:640px) 30vw, (max-width:1024px) 18vw, 170px";

/* ── landscape episode thumb ── */
export const thumb = (id?: string | null) => img(id, { w: 360, ar: "16:9" });
export const thumbSet = (id?: string | null) =>
  srcSet(id, [240, 320, 420, 560], "16:9");
export const THUMB_SIZES = "(max-width:640px) 60vw, 280px";

/* ── wide hero banner ── */
export const banner = (id?: string | null) => img(id, { w: 1200, ar: "16:6" });
export const bannerSet = (id?: string | null) =>
  srcSet(id, [640, 960, 1280, 1680, 1920], "16:6");
