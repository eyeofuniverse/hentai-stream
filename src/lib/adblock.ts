import "server-only";
import { unstable_cache } from "next/cache";

/**
 * ExoClick's AdBlock Dynamic Domains API — a rotating ad-serving domain that
 * isn't (yet) on blocklists, used as a fallback only for visitors whose
 * adblocker blocked our normal magsrv.com/pemsrv.com embeds (see
 * AdblockProvider). Must be called server-to-server — calling it from the
 * browser would itself be blockable, defeating the point. Domains rotate on
 * a 3-day active / 3-day deprecated cycle; a 6h cache is plenty fresh
 * without hammering their endpoint on every page load.
 *
 * Throws on any failure rather than returning null — unstable_cache caches
 * whatever a function *returns*, including a null, but never a throw. A
 * transient ExoClick outage should self-heal on the next call, not get
 * stuck as a cached "no domain available" for the full 6h window.
 */
async function fetchRotatedDomain(): Promise<string> {
  const res = await fetch("https://ads.exoclick.com/adblock-domains.php", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`adblock-domains.php ${res.status}`);
  const data = (await res.json()) as { success?: boolean; domain?: string };
  if (!data.success || !data.domain) throw new Error("adblock-domains.php: no domain in response");
  return data.domain;
}

const cachedRotatedDomain = unstable_cache(fetchRotatedDomain, ["exoclick-rotated-domain"], {
  revalidate: 6 * 60 * 60,
});

export async function getRotatedAdDomain(): Promise<string | null> {
  return cachedRotatedDomain().catch(() => null);
}
