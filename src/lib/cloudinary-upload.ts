// No "server-only" guard here (unlike most of src/lib) — this module is
// imported transitively by importer.ts/enrich/apply.ts, which run both
// inside Next.js AND as plain tsx CLI scripts (scrape/enrich cron jobs),
// where the server-only package isn't installed at all.
import { createHash } from "crypto";

/** cloudinary://<api_key>:<api_secret>@<cloud_name> */
function creds(): { apiKey: string; apiSecret: string; cloudName: string } | null {
  const m = (process.env.CLOUDINARY_URL ?? "").match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

/**
 * Upload a remote image URL into our Cloudinary account — Cloudinary fetches
 * the bytes itself, none of it passes through us. Returns the resulting
 * public_id (what `cover()`/`thumb()`/`banner()` in lib/cloudinary.ts expect
 * to be stored on the row), or null on any failure: source unreachable,
 * too large, not an image, Cloudinary down, credentials missing. Callers
 * should fall back to the raw external URL on null, never lose the image
 * outright over a transient upload failure.
 */
export async function uploadRemoteToCloudinary(
  remoteUrl: string | null | undefined,
  folder: string,
  publicId: string,
): Promise<string | null> {
  if (!remoteUrl || !remoteUrl.startsWith("http")) return null;
  const c = creds();
  if (!c) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const signParams: Record<string, string> = {
    folder,
    overwrite: "true",
    public_id: publicId,
    timestamp: String(timestamp),
  };
  // Cloudinary's signing spec: sort params, join as k=v&k=v, append the
  // secret, SHA1 the whole thing.
  const toSign =
    Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join("&") + c.apiSecret;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const body = new URLSearchParams({
    file: remoteUrl,
    api_key: c.apiKey,
    timestamp: String(timestamp),
    signature,
    folder,
    public_id: publicId,
    overwrite: "true",
  });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { public_id?: string };
    return data.public_id ?? null;
  } catch {
    return null;
  }
}
