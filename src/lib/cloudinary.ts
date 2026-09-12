// NOTE: this file's name is legacy — Cloudinary disabled account-wide image
// delivery for this site's content on 2026-09-12 (ACL deny, all resource
// types, even untransformed) and disabled export/archive too, so there was
// no way to migrate the actual bytes out. Every helper here now serves from
// Cloudflare R2 instead. Kept the filename + every export signature as-is
// (stored DB values are bare keys like "series/covers/<slug>", unchanged)
// so no call site anywhere else needed to change. Rename once this has
// settled.
//
// Deliberately no import from "@/lib/hosting/bunny" here, even though
// episodeThumb() needs a Bunny fallback URL — this file is imported by
// client components too (e.g. HomeHero.tsx), and bunny.ts pulls in
// Node-only modules that break the browser bundle. Callers compute the
// Bunny fallback themselves and pass it in.
const R2_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;

/**
 * Build an image delivery URL.
 *   - stored value is a storage key -> R2 public delivery
 *   - stored value is already https -> returned as-is (MAL images, dev,
 *     or anything not yet re-hosted)
 *
 * R2 has no on-the-fly resize/format/crop pipeline (unlike Cloudinary) — every
 * width/aspect request gets the same original image; `object-cover` in CSS
 * handles the visual crop client-side. `opts` is kept for call-site
 * compatibility. Pre-generated size variants (e.g. via sharp at upload time)
 * are a follow-up, not needed for images to work.
 */
export function img(
  stored: string | null | undefined,
  _opts: { w?: number; h?: number; ar?: string } = {},
): string | null {
  if (!stored) return null;
  if (stored.startsWith("http")) return stored;
  if (!R2_HOST) return null;
  return `https://${R2_HOST}/${stored}`;
}

/** No responsive variants on R2 yet — same image at every width, so a srcset
 *  would add nothing over a plain src. Null tells callers to skip it. */
export function srcSet(
  _stored: string | null | undefined,
  _widths: number[],
  _ar: string,
): string | null {
  return null;
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

/**
 * Best available thumbnail for an episode. Once a Bunny-hosted video's
 * thumbnail has been copied into R2 (see hosting/migrate.ts's
 * copyBunnyThumbToR2, which runs the moment a video finishes transcoding),
 * `thumbUrl` holds that R2 key and this returns it — free egress, cached,
 * same as every other image on the site. `bunnyFallback` (pass
 * `ep.bunnyStatus === "ready" && ep.bunnyGuid ? bunnyThumbUrl(ep.bunnyGuid) : null`
 * from the caller, which already has bunny.ts available) covers the brief
 * window between a video going ready and that copy landing, or a failed
 * copy, so nothing ever shows a blank card.
 */
export function episodeThumb(
  thumbUrl: string | null | undefined,
  bunnyFallback: string | null,
): string | null {
  return thumb(thumbUrl) ?? bunnyFallback;
}
