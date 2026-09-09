import { createHmac, timingSafeEqual } from "crypto";

/**
 * Source URLs are NEVER sent to the browser. The client gets an opaque
 * `/api/stream?e=<ep>&s=<key>&t=<hmac>` link; the route verifies the token,
 * confirms it belongs to a published episode, and 302-redirects to the real
 * target (the Bunny player embed, or a mirror file). Nothing identifiable —
 * no CDN host, no third-party domain — ever reaches the page.
 */
const SECRET =
  process.env.STREAM_SECRET ||
  process.env.CRON_SECRET ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "insecure-dev-secret-set-STREAM_SECRET";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";

export function signStream(episodeId: string, key: string): string {
  return createHmac("sha256", SECRET)
    .update(`${episodeId}:${key}`)
    .digest("base64url")
    .slice(0, 24);
}

export function verifyStream(episodeId: string, key: string, token: string): boolean {
  const want = Buffer.from(signStream(episodeId, key));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function streamPath(episodeId: string, key: string): string {
  return `/api/stream?e=${episodeId}&s=${key}&t=${signStream(episodeId, key)}`;
}

export type Server = {
  key: string;
  quality: string | null; // "1080p" | null
  kind: string; // SUB | DUB | RAW
  type: "bunny" | "hls" | "file" | "iframe";
  /** tokenised /api/stream URL — resolves server-side, never a real URL */
  src: string;
};

type SrcRow = {
  id: string;
  embedUrl: string;
  direct: boolean;
  kind: string;
  language: string;
  quality: string | null;
};

const qLabel = (q: string | null) =>
  q && q !== "UNKNOWN" ? q.replace(/^Q/, "") + "p" : null;

/**
 * Ordered playback list. The Bunny copy (our own player, designed in the Bunny
 * dashboard) is first; tokenised mirrors follow for silent auto-failover. The
 * client shows none of this — it just plays, falling through on error.
 */
export function buildServers(
  episodeId: string,
  bunnyReady: boolean,
  sources: SrcRow[],
): Server[] {
  const out: Server[] = [];

  if (bunnyReady) {
    out.push({
      key: "bunny",
      quality: "1080p",
      kind: "SUB",
      type: "bunny",
      src: streamPath(episodeId, "bunny"),
    });
  }

  for (const s of sources) {
    if (!/^https:\/\//i.test(s.embedUrl)) continue;
    if (/\?dt_embed=/.test(s.embedUrl)) continue; // un-embeddable player page
    out.push({
      key: s.id,
      quality: qLabel(s.quality),
      kind: s.kind + (s.language && s.language !== "en" ? ` ${s.language.toUpperCase()}` : ""),
      type: s.direct ? "file" : "iframe",
      src: streamPath(episodeId, s.id),
    });
    if (out.length >= 6) break;
  }

  return out;
}

/* ── server-side only: resolve a key to its real target ── */

/** Bunny Stream player embed — skinned in the Bunny dashboard (colours, logo,
 *  no download button, watermark, …). */
export function bunnyEmbed(guid: string): string {
  return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${guid}?autoplay=true&preload=true&responsive=true`;
}
