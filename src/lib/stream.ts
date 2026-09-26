import { createHmac, timingSafeEqual } from "crypto";

/**
 * Source URLs are NEVER sent to the browser. The client gets an opaque
 * `/api/stream?e=<ep>&s=<key>&t=<hmac>` link; the route verifies the token,
 * confirms it belongs to a published episode, and 302-redirects to the real
 * target (our Bunny HLS playlist, or a mirror file). Nothing identifiable —
 * no CDN host, no third-party domain — ever reaches the page.
 */
const SECRET =
  process.env.STREAM_SECRET ||
  process.env.CRON_SECRET ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "insecure-dev-secret-set-STREAM_SECRET";

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
  type: "hls" | "file" | "iframe";
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
 * Ordered playback list — the player tries them in this order and falls
 * through silently on an error, a slow start, or a mid-playback stall:
 *
 *   1. direct-file hotlinks that verify says are alive (fast, and free of
 *      Bunny delivery cost)
 *   2. our own Bunny copy (hosted HLS, played in our own Plyr player) — the
 *      safety net every episode is meant to have, so a hotlink that dies
 *      never shows the viewer a broken page
 *   3. iframe embeds, last: a cross-origin frame can't report failure, so
 *      they're the least trustworthy option
 */
export function buildServers(
  episodeId: string,
  bunnyReady: boolean,
  sources: SrcRow[],
): Server[] {
  const files: Server[] = [];
  const frames: Server[] = [];

  for (const s of sources) {
    if (!/^https:\/\//i.test(s.embedUrl)) continue;
    if (/\?dt_embed=/.test(s.embedUrl)) continue; // un-embeddable player page
    (s.direct ? files : frames).push({
      key: s.id,
      quality: qLabel(s.quality),
      kind: s.kind + (s.language && s.language !== "en" ? ` ${s.language.toUpperCase()}` : ""),
      type: s.direct ? "file" : "iframe",
      src: streamPath(episodeId, s.id),
    });
  }

  const out = files.slice(0, 3);
  if (bunnyReady) {
    out.push({
      key: "bunny",
      quality: "1080p",
      kind: "SUB",
      type: "hls",
      src: streamPath(episodeId, "bunny"),
    });
  }
  out.push(...frames.slice(0, 2));
  return out;
}

