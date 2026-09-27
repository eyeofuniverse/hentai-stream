/**
 * Bing Webmaster API client for the MCP server. Verified live against the
 * real API before writing this (its docs are thin/inconsistent): every
 * endpoint below returns its FULL retained history in one call (Bing keeps
 * roughly the last 2-3 weeks for this site) — there's no date-range request
 * parameter — so every function here fetches once and aggregates client-side
 * for the requested window. Response sizes are small (tens of rows), so this
 * is cheap. GetPageStats' rows come back typed "QueryStats" with the page URL
 * in the `Query` field — a real quirk of the API, not a bug here.
 */
const KEY = process.env.BING_WEBMASTER_API_KEY ?? "";
const SITE = process.env.BING_SITE_URL ?? "https://lusthentai.com/";
const BASE = "https://ssl.bing.com/webmaster/api.svc/json";

export function bingEnabled(): boolean {
  return !!KEY;
}

async function call<T>(method: string): Promise<T[]> {
  const url = `${BASE}/${method}?apikey=${KEY}&siteUrl=${encodeURIComponent(SITE)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bing Webmaster ${method} failed: ${res.status} ${text.slice(0, 200)}`);
  let json: { d?: T[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Bing Webmaster ${method} returned non-JSON (bad API key or unverified site?): ${text.slice(0, 200)}`);
  }
  return json.d ?? [];
}

/** Bing's dates come as .NET's `/Date(1234567890000)/` wrapper. */
function parseDotNetDate(s: string): number {
  return Number(s.match(/\d+/)?.[0] ?? 0);
}

/** Search clicks/impressions by day — Bing's equivalent of Search Console's Performance overview. */
export async function bingTrafficByDay(days: number) {
  const rows = await call<{ Date: string; Clicks: number; Impressions: number }>("GetRankAndTrafficStats");
  const since = Date.now() - days * 86_400_000;
  return rows
    .filter((r) => parseDotNetDate(r.Date) >= since)
    .sort((a, b) => parseDotNetDate(a.Date) - parseDotNetDate(b.Date))
    .map((r) => ({
      date: new Date(parseDotNetDate(r.Date)).toISOString().slice(0, 10),
      clicks: r.Clicks,
      impressions: r.Impressions,
    }));
}

/** Top search queries in the window, aggregated across days. */
export async function bingTopQueries(days: number, limit: number) {
  const rows = await call<{ Date: string; Query: string; Clicks: number; Impressions: number; AvgClickPosition: number; AvgImpressionPosition: number }>(
    "GetQueryStats",
  );
  const since = Date.now() - days * 86_400_000;
  const byQuery = new Map<string, { clicks: number; impressions: number; posSum: number; posN: number }>();
  for (const r of rows) {
    if (parseDotNetDate(r.Date) < since) continue;
    const e = byQuery.get(r.Query) ?? { clicks: 0, impressions: 0, posSum: 0, posN: 0 };
    e.clicks += r.Clicks;
    e.impressions += r.Impressions;
    if (r.AvgImpressionPosition >= 0) {
      e.posSum += r.AvgImpressionPosition * r.Impressions;
      e.posN += r.Impressions;
    }
    byQuery.set(r.Query, e);
  }
  return [...byQuery]
    .map(([query, e]) => ({
      query,
      clicks: e.clicks,
      impressions: e.impressions,
      ctr: e.impressions ? Number(((e.clicks / e.impressions) * 100).toFixed(2)) : 0,
      avgPosition: e.posN ? Number((e.posSum / e.posN).toFixed(1)) : null,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

/** Top pages by search clicks/impressions in the window, aggregated across days. */
export async function bingTopPages(days: number, limit: number) {
  const rows = await call<{ Date: string; Query: string; Clicks: number; Impressions: number; AvgImpressionPosition: number }>("GetPageStats");
  const since = Date.now() - days * 86_400_000;
  const byPage = new Map<string, { clicks: number; impressions: number; posSum: number; posN: number }>();
  for (const r of rows) {
    if (parseDotNetDate(r.Date) < since) continue;
    const page = r.Query; // GetPageStats reuses the QueryStats shape; the page URL lives in `Query`
    const e = byPage.get(page) ?? { clicks: 0, impressions: 0, posSum: 0, posN: 0 };
    e.clicks += r.Clicks;
    e.impressions += r.Impressions;
    if (r.AvgImpressionPosition >= 0) {
      e.posSum += r.AvgImpressionPosition * r.Impressions;
      e.posN += r.Impressions;
    }
    byPage.set(page, e);
  }
  return [...byPage]
    .map(([page, e]) => ({
      page,
      clicks: e.clicks,
      impressions: e.impressions,
      ctr: e.impressions ? Number(((e.clicks / e.impressions) * 100).toFixed(2)) : 0,
      avgPosition: e.posN ? Number((e.posSum / e.posN).toFixed(1)) : null,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

/** Crawl health by day: pages crawled, indexed, blocked, errored. */
export async function bingCrawlStats(days: number) {
  const rows = await call<{
    Date: string;
    CrawledPages: number;
    InIndex: number;
    CrawlErrors: number;
    BlockedByRobotsTxt: number;
    Code4xx: number;
    Code5xx: number;
  }>("GetCrawlStats");
  const since = Date.now() - days * 86_400_000;
  return rows
    .filter((r) => parseDotNetDate(r.Date) >= since)
    .sort((a, b) => parseDotNetDate(a.Date) - parseDotNetDate(b.Date))
    .map((r) => ({
      date: new Date(parseDotNetDate(r.Date)).toISOString().slice(0, 10),
      crawledPages: r.CrawledPages,
      inIndex: r.InIndex,
      crawlErrors: r.CrawlErrors,
      blockedByRobots: r.BlockedByRobotsTxt,
      code4xx: r.Code4xx,
      code5xx: r.Code5xx,
    }));
}
