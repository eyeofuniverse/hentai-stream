/**
 * Scraper fingerprint seen in the Singapore floods (Sep 17 and Sep 26): real
 * headless browsers, no referrer, rotating stale desktop user-agents — Chrome/Edge
 * 118-120 and Firefox 120/121 — long after those versions stopped being current.
 * Real desktop browsers auto-update, so a Chrome/Edge 110-129 or a non-ESR Firefox
 * 116-129 is overwhelmingly a bot. Only Windows 10/11 and macOS UAs are considered;
 * mobile/Android (old handsets are real), Windows 7/8 (NT 6.x — stuck on Chrome 109 /
 * Firefox ESR 115+128), Firefox ESR 128, TVs, ChromeOS and Linux are exempt.
 *
 * Edge-runtime safe (used from middleware). Cloudflare has the same rule at the
 * edge; this is the origin-side backstop that also covers direct *.vercel.app hits.
 */
export function isSuspectBrowserUA(ua: string): boolean {
  if (!ua) return false;
  // The scrapers only ever claim Windows 10/11 or macOS. Smart TVs (webOS 25 ships
  // Chrome 120), ChromeOS, Linux, consoles, phones and Windows 7/8 are never touched.
  if (!/Windows NT 10\.0|Macintosh/.test(ua)) return false;
  if (/Mobile|Android/.test(ua)) return false;
  const c = ua.match(/Chrome\/(\d+)\./);
  if (c) {
    const v = Number(c[1]);
    return v >= 110 && v <= 129;
  }
  const f = ua.match(/Firefox\/(\d+)\./);
  if (f) {
    const v = Number(f[1]);
    return v >= 116 && v <= 129 && v !== 128;
  }
  return false;
}

/** Self-declared crawlers/tools. Never counted as visits, views or searches. */
const DECLARED_BOT = /bot|crawl|spider|slurp|archiv|wget|curl|python|httpclient|facebookexternalhit|embedly|headless|scrapy|axios|node-fetch|go-http|java\/|okhttp|libwww|phantom/i;

/** True for anything that must not count toward analytics, view counts or
 *  trending: declared bots/tools plus the stale-UA scraper fingerprint. */
export function isBotUA(ua: string): boolean {
  return DECLARED_BOT.test(ua) || isSuspectBrowserUA(ua);
}
