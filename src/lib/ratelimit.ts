/**
 * Best-effort in-memory rate limiting for public, unauthenticated API routes.
 *
 * This is per-lambda-instance and resets on cold start — it is NOT a security
 * boundary, just a cheap way to stop a single client from hammering an endpoint
 * (view-count inflation, report-table flooding). For anything that must be
 * strictly enforced, gate on auth instead.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

/**
 * Returns true if this key is still under `limit` hits within `windowMs`.
 * Call once per request; a returned `false` means "reject".
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Best-effort client IP from the platform's proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}
