import { AwsClient } from "aws4fetch";
import sharp from "sharp";

// this module is imported transitively by importer.ts/enrich/apply.ts, which
// run both inside Next.js AND as plain tsx CLI scripts (the scrape/enrich
// cron jobs) — no "server-only" import here, same reason as r2-upload's
// predecessor (cloudinary-upload.ts).

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null;
const client =
  accessKeyId && secretAccessKey
    ? new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" })
    : null;

// R2 has no on-the-fly resize pipeline (unlike Cloudinary), so every image is
// pre-shrunk + re-encoded as webp once, here, at upload time. Caps chosen
// against the largest width each `cloudinary.ts` helper actually requests
// (cover 500w, banner 1920w, thumb 560w) plus modest retina headroom — not
// the original's full resolution, which is routinely 2-10x more than any
// card on the site ever displays.
const LIMITS: Record<string, { w: number; q: number }> = {
  covers: { w: 600, q: 82 },
  banners: { w: 1600, q: 78 },
  thumbs: { w: 640, q: 78 },
};
function limitFor(key: string): { w: number; q: number } {
  for (const [name, limit] of Object.entries(LIMITS)) {
    if (key.includes(`/${name}/`) || key.startsWith(`${name}/`)) return limit;
  }
  return { w: 800, q: 80 };
}

/** Resize/re-encode to webp. Falls back to the original bytes untouched if
 *  sharp can't process it (corrupt/unsupported source) — a slightly heavier
 *  image beats none at all. */
async function optimize(buf: ArrayBuffer, key: string): Promise<{ body: Buffer; contentType: string }> {
  const { w, q } = limitFor(key);
  try {
    const out = await sharp(Buffer.from(buf))
      .rotate() // respect EXIF orientation before any downstream consumer sees it
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
    return { body: out, contentType: "image/webp" };
  } catch {
    return { body: Buffer.from(buf), contentType: "image/jpeg" };
  }
}

/**
 * Fetch a remote image and PUT it into R2 at an exact key. Returns true on
 * success. Used both for fresh uploads (importer/enrich) and for re-populating
 * an existing key whose old value already matches what the DB has stored.
 */
export async function putR2FromUrl(key: string, remoteUrl: string): Promise<boolean> {
  if (!client || !endpoint || !bucket) return false;
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LustHentaiBot/1.0)",
        // Bunny's Stream CDN hotlink-checks the Referer (403s without one) —
        // harmless to send to every other source this fetches from too.
        Referer: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com"}/`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const raw = await res.arrayBuffer();
    if (raw.byteLength === 0 || raw.byteLength > 10 * 1024 * 1024) return false;

    const { body, contentType } = await optimize(raw, key);
    const put = await client.fetch(`${endpoint}/${bucket}/${key}`, {
      method: "PUT",
      body: body as BodyInit,
      headers: {
        "Content-Type": contentType,
        // images are re-uploaded in place only by intent (recovery/backfill
        // scripts, both idempotent) — a year is safe, and CDN-Cache-Control
        // lets Cloudflare's edge cache it separately from the browser.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    return put.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch a remote image and store it in R2 at `<folder>/<id>` — the same key
 * shape the old Cloudinary public_ids used, so existing DB rows (which store
 * that bare key, not a full URL) need no migration, only re-populating.
 * Returns the key on success (to store as-is in coverUrl/bannerUrl/etc), or
 * null on any failure — callers fall back to the raw remote URL.
 */
export async function uploadRemoteToR2(
  remoteUrl: string,
  folder: string,
  id: string,
): Promise<string | null> {
  const key = `${folder}/${id}`;
  return (await putR2FromUrl(key, remoteUrl)) ? key : null;
}
