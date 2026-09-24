/** Hosts confirmed live to actually work through ExoClick's rotated
 *  adblock-recovery domain (verified directly: /v1/vast.php and the
 *  popunder's venor.php/link.php all resolve correctly through it).
 *  Deliberately excludes a.magsrv.com — the banner ad-provider.js script
 *  404s on the rotated domain, so rewriting it would silently break banner
 *  ads for adblock users instead of recovering them. ExoClick's Dynamic
 *  Domains API only covers VAST + Popunder, not banners; a full banner
 *  fix would need their separate NeverBlock proxy product instead. */
const EXOCLICK_HOSTS = ["s.magsrv.com", "a.pemsrv.com", "s.pemsrv.com"];

export function rewriteForAdblock(code: string, rotatedDomain: string): string {
  let out = code;
  for (const host of EXOCLICK_HOSTS) out = out.split(host).join(rotatedDomain);
  return out;
}
