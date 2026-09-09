/**
 * Bunny Stream API client — https://docs.bunny.net/reference/video_getvideo
 * We create a video, hand Bunny a source URL to fetch (optionally with a
 * Referer header for locked origins), and it transcodes + serves HLS from the
 * b-cdn.net pull zone. Playback is our own player pointed at the HLS URL.
 */
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID ?? "";
const API_KEY = process.env.BUNNY_STREAM_API_KEY ?? "";
const CDN_HOST = process.env.NEXT_PUBLIC_BUNNY_CDN_HOST ?? "";
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

/* ─────────────────────────── playback URLs ─────────────────────────── */

export const hlsUrl = (guid: string) => `https://${CDN_HOST}/${guid}/playlist.m3u8`;
export const thumbUrl = (guid: string) => `https://${CDN_HOST}/${guid}/thumbnail.jpg`;
export const previewUrl = (guid: string) => `https://${CDN_HOST}/${guid}/preview.webp`;
