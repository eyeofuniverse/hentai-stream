import { createHmac, timingSafeEqual } from "crypto";
import { hlsUrl } from "@/lib/hosting/bunny";

/**
 * Video source URLs are NEVER sent to the browser. The client gets an opaque
 * `/api/stream?e=<ep>&s=<src>&t=<hmac>` link; the route verifies the token,
 * confirms the source belongs to a published episode, and 302-redirects to the
 * real URL. Keeps third-party CDN links out of the page source.
 */
const SECRET =
  process.env.STREAM_SECRET ||
  process.env.CRON_SECRET ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "insecure-dev-secret-set-STREAM_SECRET";

export function signStream(episodeId: string, sourceKey: string): string {
  return createHmac("sha256", SECRET)
    .update(`${episodeId}:${sourceKey}`)
    .digest("base64url")
    .slice(0, 24);
}

export function verifyStream(episodeId: string, sourceKey: string, token: string): boolean {
  const want = Buffer.from(signStream(episodeId, sourceKey));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function streamPath(episodeId: string, sourceKey: string): string {
  return `/api/stream?e=${episodeId}&s=${sourceKey}&t=${signStream(episodeId, sourceKey)}`;
}

export type Server = {
  key: string;
  label: string; // "HD", "SUB 1080p", …
  quality: string | null; // "1080p" | null
  kind: string; // SUB | DUB | RAW
  type: "hls" | "file" | "iframe";
  /** tokenised /api/stream URL — no real source URL client-side */
  src: string;
};

type SrcRow = {
  id: string;
  embedUrl: string;
  direct: boolean;
  host: string;
  hostName: string | null;
  kind: string;
  language: string;
  quality: string | null;
};

const qLabel = (q: string | null) =>
  q && q !== "UNKNOWN" ? q.replace(/^Q/, "") + "p" : null;

/**
 * Build the client-safe server list. The Bunny copy (if ready) is first; up to a
 * few tokenised third-party fallbacks follow. Returns [] if nothing plays.
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
      label: "HD",
      quality: "1080p",
      kind: "SUB",
      type: "hls",
      src: streamPath(episodeId, "bunny"),
    });
  }

  for (const s of sources) {
    if (!/^https:\/\//i.test(s.embedUrl)) continue;
    if (/\?dt_embed=/.test(s.embedUrl)) continue; // un-embeddable player page
    out.push({
      key: s.id,
      label:
        s.host === "OTHER" ? s.hostName || "Mirror" : s.host[0] + s.host.slice(1).toLowerCase(),
      quality: qLabel(s.quality),
      kind: s.kind + (s.language && s.language !== "en" ? ` ${s.language.toUpperCase()}` : ""),
      type: s.direct ? "file" : "iframe",
      src: streamPath(episodeId, s.id),
    });
    if (out.length >= 5) break;
  }

  return out;
}

/** Resolve a stream key to the real URL — used only server-side by the route. */
export function bunnyHls(guid: string): string {
  return hlsUrl(guid);
}
