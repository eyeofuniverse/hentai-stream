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
 */
async function fetchRotatedDomain(): Promise<string | null> {
  try {
    const res = await fetch("https://ads.exoclick.com/adblock-domains.php", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; domain?: string };
    return data.success && data.domain ? data.domain : null;
  } catch {
    return null;
  }
}

export const getRotatedAdDomain = unstable_cache(fetchRotatedDomain, ["exoclick-rotated-domain"], {
  revalidate: 6 * 60 * 60,
});
