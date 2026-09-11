import "server-only";
import { SITE } from "@/lib/seo";

const MAX_BYTES = 3_000_000; // generous cap for a jpg/webp cover or thumb

/**
 * Fetch an image server-side and hand back a data: URI, for embedding in an
 * ImageResponse (next/og) template.
 *
 * Two things next/og's own image loading can't do, which this exists for:
 *  - Bunny's CDN has referer-based hotlink protection, so ImageResponse's own
 *    internal fetch (no Referer) gets a 403. We send one here.
 *  - A slow or dead third-party host (most series covers are hotlinked from
 *    MAL/AniList) must never take down the whole share card — bounded
 *    timeout, any failure just means no image in the template.
 */
export async function fetchAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: {
        Referer: `${SITE}/`,
        "User-Agent": "Mozilla/5.0 (compatible; LustHentaiOG/1.0)",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}
