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

/** Ask Bunny to pull a source URL into an existing video. */
export function fetchIntoVideo(
  guid: string,
  url: string,
  headers?: Record<string, string>,
): Promise<{ success: boolean; message: string; statusCode: number }> {
  return call("/videos/" + guid + "/fetch", {
    method: "POST",
    body: JSON.stringify({ url, ...(headers ? { headers } : {}) }),
  });
}

export function getVideo(guid: string): Promise<BunnyVideo> {
  return call<BunnyVideo>("/videos/" + guid, { method: "GET" });
}

export async function deleteVideo(guid: string): Promise<void> {
  await call("/videos/" + guid, { method: "DELETE", retries: 1 }).catch(() => {});
}

/* ─────────────────────────── playback URLs ─────────────────────────── */

export const hlsUrl = (guid: string) => `https://${CDN_HOST}/${guid}/playlist.m3u8`;
export const thumbUrl = (guid: string) => `https://${CDN_HOST}/${guid}/thumbnail.jpg`;
export const previewUrl = (guid: string) => `https://${CDN_HOST}/${guid}/preview.webp`;
