import { AwsClient } from "aws4fetch";

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

/**
 * Fetch a remote image and PUT it into R2 at an exact key. Returns true on
 * success. Used both for fresh uploads (importer/enrich) and for re-populating
 * an existing key whose old value already matches what the DB has stored.
 */
export async function putR2FromUrl(key: string, remoteUrl: string): Promise<boolean> {
  if (!client || !endpoint || !bucket) return false;
  try {
    const res = await fetch(remoteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LustHentaiBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 10 * 1024 * 1024) return false;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const put = await client.fetch(`${endpoint}/${bucket}/${key}`, {
      method: "PUT",
      body: buf,
      headers: { "Content-Type": contentType },
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
