import { createSign } from "node:crypto";

/**
 * GA4 Data API client for the MCP server — a service-account JWT bearer flow,
 * hand-rolled instead of pulling in `googleapis` (multi-hundred-KB package for
 * two endpoints; every other external API in this codebase — ExoClick, Bunny,
 * MAL — is a thin hand-written fetch wrapper, same pattern here).
 *
 * Verified live against the real API before writing this: the service
 * account's project has the GA4 Data API enabled (Admin API is NOT, so this
 * can't self-discover property IDs — GA4_PROPERTY_ID must be set by hand,
 * and the service account must be added as a Viewer on that property in
 * GA4's Admin > Property Access Management, a step Google Cloud IAM cannot
 * do on its own).
 */

const CLIENT_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL ?? "";
// Vercel/GitHub env vars can't hold real newlines cleanly — stored with
// literal "\n" escapes, unescaped here (the standard convention for pasting
// a PEM private key into a single-line env var).
const PRIVATE_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? "";

export function ga4Enabled(): boolean {
  return !!(CLIENT_EMAIL && PRIVATE_KEY && PROPERTY_ID);
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cached: { token: string; expiresAt: number } | null = null;

/** Short-lived (1h) bearer token via the service-account JWT flow. Cached in
 *  memory for the life of the process — fine for a serverless function that's
 *  reused across a handful of requests, and harmless to re-derive on a cold start. */
async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer
    .sign(PRIVATE_KEY)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token exchange failed: ${body.error ?? res.status} ${body.error_description ?? ""}`);
  }
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

type Row = { dims: string[]; metrics: number[] };

async function runReport(body: Record<string, unknown>): Promise<{ dimensionHeaders: string[]; metricHeaders: string[]; rows: Row[] }> {
  const token = await getAccessToken();
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
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
export async function ga4TrafficByDay(days: number) {
  const { rows } = await runReport({
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
export async function ga4TopPages(days: number, limit: number) {
  const { rows } = await runReport({
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
export async function ga4TrafficSources(days: number, limit: number) {
  const { rows } = await runReport({
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
export async function ga4Audience(days: number) {
  const [devices, countries] = await Promise.all([
    runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runReport({
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
