import { SITE } from "@/lib/seo";

// IndexNow — instantly tells Bing, Yandex, Seznam, Naver (and others sharing the
// protocol) that URLs changed. The key is public by design: it just has to be
// served at https://<host>/<key>.txt (see public/<key>.txt).
const KEY = process.env.INDEXNOW_KEY ?? "b90f317fa6ce323e55b06a7f5b3ab9b7";

/** Fire-and-forget. Accepts absolute URLs or site-root paths. Max 10k/req. */
export async function pingIndexNow(urlsOrPaths: string[]): Promise<void> {
  if (!SITE.startsWith("https://")) return; // localhost / preview — skip
  const host = new URL(SITE).host;
  const urlList = [...new Set(urlsOrPaths)]
    .map((u) => (u.startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`))
    .slice(0, 10_000);
  if (urlList.length === 0) return;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(8000),
    });
    // IndexNow answers 200/202 on success. This used to go unchecked, so an
    // empty INDEXNOW_KEY env var (falling through the `??` default only
    // catches null/undefined, not "") sent key:"" and got a 400 on every
    // call for days — completely silent, because nothing ever looked. Log
    // it now so a broken key/host shows up in the run's own output.
    if (!res.ok && res.status !== 202) {
      console.error(`IndexNow ping rejected: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`IndexNow ping failed: ${(e as Error).message}`);
  }
}

/**
 * Same idea, but for the one-off "submit the whole catalogue" bulk job —
 * loops through ALL urls in batches of 10k (IndexNow's own per-request cap)
 * instead of silently truncating like pingIndexNow does, and reports back
 * how many actually went through so the console can show a real count.
 */
export async function pingIndexNowBulk(
  urlsOrPaths: string[],
): Promise<{ submitted: number; failed: number }> {
  if (!SITE.startsWith("https://")) return { submitted: 0, failed: 0 };
  const host = new URL(SITE).host;
  const urlList = [...new Set(urlsOrPaths)].map((u) =>
    u.startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`,
  );

  let submitted = 0;
  let failed = 0;
  for (let i = 0; i < urlList.length; i += 10_000) {
    const chunk = urlList.slice(i, i + 10_000);
    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          host,
          key: KEY,
          keyLocation: `${SITE}/${KEY}.txt`,
          urlList: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      // IndexNow answers 200 or 202 on success
      if (res.ok || res.status === 202) submitted += chunk.length;
      else failed += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }
  return { submitted, failed };
}
