import { getGoogleAccessToken, googleSaConfigured } from "@/lib/mcp/google-auth";

/**
 * Google Search Console (Search Analytics) API client for the MCP server —
 * same service-account JWT pattern as google-analytics.ts, different scope.
 * Unlike Bing, this API genuinely supports a date range + dimension server-
 * side, so there's no client-side aggregation needed here — GSC does the
 * work and ctr/position come back already averaged over the window.
 *
 * The service account needs to be added as a user on each site in Search
 * Console (Settings > Users and permissions — "Restricted" is enough for
 * read-only queries) before this will return data for that site, the same
 * manual step GA4 needs on its side.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function gscEnabled(siteUrl: string): boolean {
  return googleSaConfigured() && !!siteUrl;
}

type Row = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function query(siteUrl: string, body: Record<string, unknown>): Promise<Row[]> {
  const token = await getGoogleAccessToken(SCOPE);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(
      `Search Console query failed: ${res.status} ${json?.error?.message ?? JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return (json.rows ?? []) as Row[];
}

function dateRange(days: number): { startDate: string; endDate: string } {
  // GSC's data typically lags 2-3 days behind real time — asking for
  // "today" just comes back with zero rows for the unprocessed tail, same
  // non-issue as GA4's partial-day caveat elsewhere in this codebase.
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

/** Search clicks/impressions by day — Search Console's Performance overview. */
export async function gscTrafficByDay(siteUrl: string, days: number) {
  const rows = await query(siteUrl, { ...dateRange(days), dimensions: ["date"], rowLimit: Math.min(days, 180) });
  return rows
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
    .map((r) => ({
      date: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Number((r.ctr * 100).toFixed(2)),
      avgPosition: Number(r.position.toFixed(1)),
    }));
}

/** Top search queries by clicks over the window. */
export async function gscTopQueries(siteUrl: string, days: number, limit: number) {
  const rows = await query(siteUrl, { ...dateRange(days), dimensions: ["query"], rowLimit: limit });
  return rows
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Number((r.ctr * 100).toFixed(2)),
      avgPosition: Number(r.position.toFixed(1)),
    }));
}

/** Top pages by clicks over the window. */
export async function gscTopPages(siteUrl: string, days: number, limit: number) {
  const rows = await query(siteUrl, { ...dateRange(days), dimensions: ["page"], rowLimit: limit });
  return rows
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .map((r) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Number((r.ctr * 100).toFixed(2)),
      avgPosition: Number(r.position.toFixed(1)),
    }));
}
