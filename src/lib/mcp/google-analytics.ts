import { getGoogleAccessToken, googleSaConfigured } from "@/lib/mcp/google-auth";

/**
 * GA4 Data API client for the MCP server — a service-account JWT bearer flow,
 * hand-rolled instead of pulling in `googleapis` (multi-hundred-KB package for
 * two endpoints; every other external API in this codebase — ExoClick, Bunny,
 * MAL — is a thin hand-written fetch wrapper, same pattern here).
 *
 * Verified live against the real API before writing this: the service
 * account's project has the GA4 Data API enabled (Admin API is NOT, so this
 * can't self-discover property IDs — each site's property ID must be set by
 * hand in sites.ts/env, and the service account must be added as a Viewer on
 * that property in GA4's Admin > Property Access Management, a step Google
 * Cloud IAM cannot do on its own — needed per property, not just once).
 */

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export function ga4Enabled(propertyId: string): boolean {
  return googleSaConfigured() && !!propertyId;
}

type Row = { dims: string[]; metrics: number[] };

async function runReport(
  propertyId: string,
  body: Record<string, unknown>,
): Promise<{ dimensionHeaders: string[]; metricHeaders: string[]; rows: Row[] }> {
  const token = await getGoogleAccessToken(SCOPE);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${json?.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
  const dimensionHeaders = (json.dimensionHeaders ?? []).map((d: any) => d.name);
  const metricHeaders = (json.metricHeaders ?? []).map((m: any) => m.name);
  const rows: Row[] = (json.rows ?? []).map((r: any) => ({
    dims: (r.dimensionValues ?? []).map((v: any) => v.value),
    metrics: (r.metricValues ?? []).map((v: any) => Number(v.value)),
  }));
  return { dimensionHeaders, metricHeaders, rows };
}

const DATE_METRICS = ["sessions", "activeUsers", "screenPageViews", "engagementRate", "averageSessionDuration"];

/** Traffic by day: sessions, users, pageviews, engagement rate. */
export async function ga4TrafficByDay(propertyId: string, days: number) {
  const { rows } = await runReport(propertyId, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: DATE_METRICS.map((name) => ({ name })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return rows.map((r) => ({
    date: `${r.dims[0].slice(0, 4)}-${r.dims[0].slice(4, 6)}-${r.dims[0].slice(6, 8)}`,
    sessions: r.metrics[0],
    activeUsers: r.metrics[1],
    pageViews: r.metrics[2],
    engagementRate: Number((r.metrics[3] * 100).toFixed(1)),
    avgSessionSec: Math.round(r.metrics[4]),
  }));
}

/** Top pages by pageviews over the period. */
export async function ga4TopPages(propertyId: string, days: number, limit: number) {
  const { rows } = await runReport(propertyId, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "engagementRate" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: String(limit),
  });
  return rows.map((r) => ({
    path: r.dims[0],
    pageViews: r.metrics[0],
    activeUsers: r.metrics[1],
    engagementRate: Number((r.metrics[2] * 100).toFixed(1)),
  }));
}

/** Where sessions came from (channel grouping + source/medium). */
export async function ga4TrafficSources(propertyId: string, days: number, limit: number) {
  const { rows } = await runReport(propertyId, {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: String(limit),
  });
  return rows.map((r) => ({
    channel: r.dims[0],
    source: r.dims[1],
    sessions: r.metrics[0],
    activeUsers: r.metrics[1],
  }));
}

/** Devices and countries, for a quick audience shape check. */
export async function ga4Audience(propertyId: string, days: number) {
  const [devices, countries] = await Promise.all([
    runReport(propertyId, {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runReport(propertyId, {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "15",
    }),
  ]);
  return {
    byDevice: devices.rows.map((r) => ({ device: r.dims[0], sessions: r.metrics[0] })),
    byCountry: countries.rows.map((r) => ({ country: r.dims[0], sessions: r.metrics[0] })),
  };
}
