/**
 * Scraper fingerprint seen in the Singapore floods (Sep 17 and Sep 26): real
 * headless browsers, no referrer, rotating stale desktop user-agents — Chrome/Edge
 * 118-120 and Firefox 120/121 — long after those versions stopped being current.
 * Real desktop browsers auto-update, so a Chrome/Edge 110-129 or a non-ESR Firefox
 * 116-129 is overwhelmingly a bot. Exempt on purpose: mobile/Android (old handsets
 * are real), Windows 7/8 (NT 6.x — stuck on Chrome 109 / Firefox ESR 115+128) and
 * Firefox ESR 115/128.
 *
 * Edge-runtime safe (used from middleware). Cloudflare has the same rule at the
 * edge; this is the origin-side backstop that also covers direct *.vercel.app hits.
 */
export function isSuspectBrowserUA(ua: string): boolean {
  if (!ua) return false;
  if (/Mobile|Android|Windows NT 6\./.test(ua)) return false;
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
