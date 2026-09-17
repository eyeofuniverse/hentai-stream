/**
 * Bunny Stream API client — https://docs.bunny.net/reference/video_getvideo
 * We create a video, hand Bunny a source URL to fetch (optionally with a
 * Referer header for locked origins), and it transcodes + serves HLS from the
 * b-cdn.net pull zone. Playback is our own player pointed at the HLS URL.
 */
import { createHmac } from "node:crypto";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";
const API_KEY = process.env.BUNNY_STREAM_API_KEY ?? "";
const CDN_HOST = process.env.NEXT_PUBLIC_BUNNY_CDN_HOST ?? "";
const SECURITY_KEY = process.env.BUNNY_STREAM_SECURITY_KEY ?? "";
const API = `https://video.bunnycdn.com/library/${LIBRARY_ID}`;

export function bunnyEnabled(): boolean {
  return Boolean(LIBRARY_ID && API_KEY && CDN_HOST);
}

/** Bunny's numeric status → our string. */
export type BunnyStatus = "queued" | "fetching" | "processing" | "ready" | "failed";
export function mapStatus(code: number): BunnyStatus {
  switch (code) {
    case 0:
      return "queued";
    case 1:
      return "fetching";
    case 2:
    case 3:
      return "processing";
    case 4:
      return "ready";
    default:
      return "failed"; // 5 error, 6 upload failed
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { retries = 3, ...rest } = init;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${API}${path}`, {
        ...rest,
        signal: AbortSignal.timeout(30_000),
        headers: {
          AccessKey: API_KEY,
          accept: "application/json",
          "content-type": "application/json",
          ...rest.headers,
        },
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`Bunny ${res.status}`);
      if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`);
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

export interface BunnyVideo {
  guid: string;
  title: string;
  status: number;
  length: number; // seconds
  width: number;
  height: number;
  thumbnailFileName?: string;
}

export function createVideo(title: string): Promise<BunnyVideo> {
  return call<BunnyVideo>("/videos", {
    method: "POST",
    body: JSON.stringify({ title: title.slice(0, 200) }),
  });
}

/**
 * Ask Bunny to pull a source URL into an existing video.
 *
 * Bunny answers a bad source with HTTP 422 and a JSON body like
 * `{"success":false,"message":"Origin returned HTTP 404 (Not Found).","statusCode":422}`.
 * That is a real answer, not a transport error — so we return the body instead
 * of throwing, and the caller decides (e.g. mark the source DEAD on a 404).
 * Only genuine transport failures (429 / 5xx / network) throw, so the retry
 * still helps there.
 */
export async function fetchIntoVideo(
  guid: string,
  url: string,
  headers?: Record<string, string>,
): Promise<{ success: boolean; message: string; statusCode: number }> {
  const retries = 3;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${API}/videos/${guid}/fetch`, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          AccessKey: API_KEY,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ url, ...(headers ? { headers } : {}) }),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Bunny ${res.status}`);
      }
      const text = await res.text();
      const body = (text ? JSON.parse(text) : {}) as Partial<{
        success: boolean;
        message: string;
        statusCode: number;
      }>;
      return {
        success: body.success ?? res.ok,
        message: body.message ?? (res.ok ? "" : `HTTP ${res.status}`),
        statusCode: body.statusCode ?? res.status,
      };
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

export function getVideo(guid: string): Promise<BunnyVideo> {
  return call<BunnyVideo>("/videos/" + guid, { method: "GET" });
}

/**
 * Upload a local video file into an existing Bunny video (PUT the raw bytes).
 * Bunny transcodes to HLS afterwards, same as a remote fetch.
 */
export async function uploadVideoFile(
  guid: string,
  filePath: string,
): Promise<void> {
  const { createReadStream, statSync } = await import("node:fs");
  const { Readable } = await import("node:stream");
  const size = statSync(filePath).size;

  const init: RequestInit & { duplex: "half" } = {
    method: "PUT",
    duplex: "half",
    headers: {
      AccessKey: API_KEY,
      "content-type": "application/octet-stream",
      "content-length": String(size),
    },
    body: Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream,
    signal: AbortSignal.timeout(60 * 60_000), // 1h for a big file
  };
  const res = await fetch(`${API}/videos/${guid}`, init);
  if (!res.ok) throw new Error(`Bunny upload ${res.status}: ${await res.text()}`);
}

export async function deleteVideo(guid: string): Promise<void> {
  await call("/videos/" + guid, { method: "DELETE", retries: 1 }).catch(() => {});
}

export interface BunnyVideoListItem {
  guid: string;
  status: number;
  storageSize: number;
}

/** Every video in the library, paginated — used by the orphan-reconcile job,
 *  not the request path (this walks the whole library, thousands of rows). */
export async function listAllVideos(): Promise<BunnyVideoListItem[]> {
  const perPage = 100;
  let page = 1;
  let all: BunnyVideoListItem[] = [];
  while (true) {
    const data = await call<{ items: BunnyVideoListItem[]; totalItems: number }>(
      `/videos?page=${page}&itemsPerPage=${perPage}&orderBy=date`,
    );
    all = all.concat(data.items);
    if (all.length >= data.totalItems || data.items.length === 0) break;
    page++;
  }
  return all;
}

/* ─────────────────────────── playback URLs ─────────────────────────── */

/**
 * Bunny CDN Token Authentication V2 (HMAC-SHA256), ported from Bunny's own
 * reference implementation (github.com/BunnyWay/BunnyCDN.TokenAuthentication,
 * nodejs/token.js) — the only source that has the exact byte order, since
 * Bunny's docs describe it ambiguously and there's a legacy MD5/raw-SHA256
 * scheme that looks similar but isn't compatible.
 *
 * No IP lock, no country rules — those aren't part of our threat model here
 * and every extra feature is another way to get the signature wrong.
 */
function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Single-file token: `?token=...&expires=...` on the exact path given. */
function signBunnyFile(filePath: string, ttlSeconds: number): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const hmac = createHmac("sha256", SECURITY_KEY);
  hmac.update(filePath);
  hmac.update(String(expires));
  const token = "HS256-" + base64Url(hmac.digest());
  return `https://${CDN_HOST}${filePath}?token=${token}&expires=${expires}`;
}

/**
 * Directory token: authorizes every file under `dirPath`, not just `filePath`.
 * HLS needs this — the player resolves segment/rendition URLs relative to the
 * playlist itself, so a token scoped to just playlist.m3u8 would leave every
 * .ts segment and quality variant unauthenticated.
 */
function signBunnyDirectory(filePath: string, dirPath: string, ttlSeconds: number): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signingData = `token_path=${dirPath}`;
  const hmac = createHmac("sha256", SECURITY_KEY);
  hmac.update(dirPath);
  hmac.update(String(expires));
  hmac.update(signingData);
  const token = "HS256-" + base64Url(hmac.digest());
  const urlData = `token_path=${encodeURIComponent(dirPath)}`;
  return `https://${CDN_HOST}/bcdn_token=${token}&${urlData}&expires=${expires}${filePath}`;
}

// Playlist tokens are minted fresh per /api/stream request (never cached), so
// a short TTL is fine and limits how long a captured URL stays useful.
const HLS_TTL = 6 * 60 * 60; // 6h
// Thumbnails/previews get baked into ISR HTML, sitemaps and OG images, whose
// longest revalidate window in this app is 12h (hentai/[slug] pages) — give
// enough margin that a low-traffic page's stale cache never 403s.
const IMAGE_TTL = 48 * 60 * 60; // 48h

export const hlsUrl = (guid: string) =>
  SECURITY_KEY
    ? signBunnyDirectory(`/${guid}/playlist.m3u8`, `/${guid}/`, HLS_TTL)
    : `https://${CDN_HOST}/${guid}/playlist.m3u8`;

export const thumbUrl = (guid: string) =>
  SECURITY_KEY
    ? signBunnyFile(`/${guid}/thumbnail.jpg`, IMAGE_TTL)
    : `https://${CDN_HOST}/${guid}/thumbnail.jpg`;

export const previewUrl = (guid: string) =>
  SECURITY_KEY
    ? signBunnyFile(`/${guid}/preview.webp`, IMAGE_TTL)
    : `https://${CDN_HOST}/${guid}/preview.webp`;
