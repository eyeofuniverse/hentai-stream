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

/**
 * Best-effort client IP from the platform's proxy headers.
 *
 * `cf-connecting-ip` goes first: this site sits behind Cloudflare, and that
 * header is the one Cloudflare's own edge sets from the real TCP connection
 * — the client can't forge it. `x-forwarded-for` was checked first before,
 * which is wrong for this setup: by the time a request reaches Vercel it's
 * arriving FROM Cloudflare's edge, so a hop can end up appending Cloudflare's
 * own IP rather than preserving the original visitor's. Confirmed live —
 * nearly every IP logged in `pageVisit` traced back to a published Cloudflare
 * edge range (104.23.x.x, 172.68-71.x.x, 162.158.x.x, 141.101.x.x), not real
 * visitors — which had been silently corrupting geo stats, unique-visitor
 * counts, AND rate limiting (including the console login attempt limiter)
 * this whole time.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

/**
 * True if this request's Origin (or, failing that, Referer) header names the
 * same host the request itself came in on. Browsers set Origin/Referer
 * automatically on a fetch() and page JS cannot override them, so a same-site
 * page load always passes this — but a script POSTing straight at the API
 * from anywhere else fails it, unless it fakes the header outright (which a
 * casual analytics-flooding script generally doesn't bother to).
 *
 * Deliberately compares against the request's own `Host` header rather than
 * a hardcoded domain, so it works unchanged across lusthentai.com,
 * hentai-stream.vercel.app, preview deployments, and local dev.
 *
 * Confirmed live before this existed: `curl -X POST /api/track` with an
 * arbitrary `path` was accepted and landed in `pageVisit` with no same-site
 * signal at all — anyone could inflate view/visitor counts without ever
 * loading a real page. Gate write-and-count endpoints (track, view, search
 * trending) on this; it's not a security boundary (a targeted attacker can
 * still fake the header), just a bar that stops casual/scripted inflation.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}
