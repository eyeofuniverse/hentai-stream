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
    await fetch("https://api.indexnow.org/indexnow", {
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
  } catch {
    /* best effort — a missed ping just means slower discovery */
  }
}
