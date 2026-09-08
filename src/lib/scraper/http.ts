/**
 * Polite HTTP client for one site: a single serial request queue with a minimum
 * gap between requests, a real browser UA, retry-with-backoff on 429/5xx, and a
 * hard per-request timeout. One instance per adapter.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export class Http {
  private queue: Promise<unknown> = Promise.resolve();
  private lastAt = 0;

  constructor(
    private readonly minGapMs = 1500,
    private readonly timeoutMs = 30_000,
  ) {}

  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.minGapMs - (Date.now() - this.lastAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.lastAt = Date.now();
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private async raw(url: string, init?: RequestInit): Promise<Response> {
    return this.schedule(async () => {
      let lastErr: unknown;
      for (let i = 0; i < 4; i++) {
        try {
          const res = await fetch(url, {
            ...init,
            redirect: "follow",
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: {
              "user-agent": UA,
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "en-US,en;q=0.9",
              ...(init?.headers ?? {}),
            },
          });
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res;
        } catch (e) {
          lastErr = e;
          if (i < 3) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
        }
      }
      throw lastErr;
    });
  }

  async get(url: string): Promise<string> {
    const res = await this.raw(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.text();
  }

  async getMaybe(url: string): Promise<string | null> {
    try {
      const res = await this.raw(url);
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }

  async postForm(url: string, body: Record<string, string>): Promise<string> {
    const res = await this.raw(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: new URLSearchParams(body).toString(),
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.text();
  }

  async getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const res = await this.raw(url, { headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  async postJson<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const res = await this.raw(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.json() as Promise<T>;
  }
}

/** Extract <loc> values from a sitemap XML string. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
}

/** Decode the handful of HTML entities that show up in scraped URLs. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
