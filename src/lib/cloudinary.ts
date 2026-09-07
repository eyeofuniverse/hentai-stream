const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Build an optimized delivery URL.
 *   - stored value is a Cloudinary public id  -> upload delivery
 *   - stored value is already an https url     -> returned as-is (dev / fallback)
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

/** Portrait cover (series) and landscape thumb (episode) presets. */
export const cover = (id?: string | null) => img(id, { w: 360, ar: "2:3" });
export const thumb = (id?: string | null) => img(id, { w: 480, ar: "16:9" });
export const banner = (id?: string | null) => img(id, { w: 1280, ar: "16:5" });
