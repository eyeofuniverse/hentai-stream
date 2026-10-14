import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { tokenEqual } from "@/lib/admin/gate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { ga4Enabled, ga4TrafficByDay, ga4TopPages, ga4TrafficSources, ga4Audience } from "@/lib/mcp/google-analytics";
import { bingEnabled, bingTrafficByDay, bingTopQueries, bingTopPages, bingCrawlStats } from "@/lib/mcp/bing-webmaster";
import { gscEnabled, gscTrafficByDay, gscTopQueries, gscTopPages } from "@/lib/mcp/search-console";
import { SITES, SITE_KEYS, type SiteKey } from "@/lib/mcp/sites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN = process.env.MCP_ACCESS_TOKEN ?? "";

/** JSON-RPC-friendly tool result — every tool below just returns data via this. */
function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const siteLabels = SITE_KEYS.map((k) => `"${k}" = ${SITES[k].label}`).join(", ");
const siteArg = {
  site: z
    .enum(SITE_KEYS as [SiteKey, ...SiteKey[]])
    .default("lusthentai")
    .describe(`Which property to report on (${siteLabels})`),
};
const daysArg = { days: z.number().int().min(1).max(180).default(30).describe("How many days back from today") };
const limitArg = (def: number) => z.number().int().min(1).max(100).default(def).describe("Max rows to return");

function buildServer(): McpServer {
  const server = new McpServer({ name: "lust-network-analytics", version: "2.0.0" });

  server.registerTool(
    "ga4_traffic_by_day",
    { title: "GA4 traffic by day", description: `Google Analytics 4: sessions, active users, page views and engagement rate per day. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg } },
    async ({ site, days }) => {
      const propertyId = SITES[site].ga4PropertyId;
      if (!ga4Enabled(propertyId)) return err(`GA4 isn't configured for ${SITES[site].label} yet — missing GA4_PROPERTY_ID${site === "lusthentai" ? "" : "_" + site.toUpperCase()} (or the shared GOOGLE_SA_CLIENT_EMAIL/GOOGLE_SA_PRIVATE_KEY).`);
      try {
        return json(await ga4TrafficByDay(propertyId, days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_top_pages",
    { title: "GA4 top pages", description: `Google Analytics 4: top pages by page views over a date range, with active users and engagement rate. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(20) } },
    async ({ site, days, limit }) => {
      const propertyId = SITES[site].ga4PropertyId;
      if (!ga4Enabled(propertyId)) return err(`GA4 isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await ga4TopPages(propertyId, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_traffic_sources",
    { title: "GA4 traffic sources", description: `Google Analytics 4: sessions broken down by channel group and source (organic search, direct, referral, etc.). Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(15) } },
    async ({ site, days, limit }) => {
      const propertyId = SITES[site].ga4PropertyId;
      if (!ga4Enabled(propertyId)) return err(`GA4 isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await ga4TrafficSources(propertyId, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_audience",
    { title: "GA4 audience shape", description: `Google Analytics 4: sessions by device category and by country over a date range. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg } },
    async ({ site, days }) => {
      const propertyId = SITES[site].ga4PropertyId;
      if (!ga4Enabled(propertyId)) return err(`GA4 isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await ga4Audience(propertyId, days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_traffic_by_day",
    { title: "Bing search traffic by day", description: `Bing Webmaster Tools: search clicks and impressions per day. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg } },
    async ({ site, days }) => {
      const siteUrl = SITES[site].bingSiteUrl;
      if (!bingEnabled(siteUrl)) return err(`Bing Webmaster isn't configured for ${SITES[site].label} yet — BING_WEBMASTER_API_KEY is missing.`);
      try {
        return json(await bingTrafficByDay(siteUrl, days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_top_queries",
    { title: "Bing top search queries", description: `Bing Webmaster Tools: top search queries by clicks over a date range, with impressions, CTR and average position. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(25) } },
    async ({ site, days, limit }) => {
      const siteUrl = SITES[site].bingSiteUrl;
      if (!bingEnabled(siteUrl)) return err(`Bing Webmaster isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await bingTopQueries(siteUrl, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_top_pages",
    { title: "Bing top pages", description: `Bing Webmaster Tools: top pages by search clicks over a date range, with impressions, CTR and average position. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(25) } },
    async ({ site, days, limit }) => {
      const siteUrl = SITES[site].bingSiteUrl;
      if (!bingEnabled(siteUrl)) return err(`Bing Webmaster isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await bingTopPages(siteUrl, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_crawl_stats",
    { title: "Bing crawl & index stats", description: `Bing Webmaster Tools: pages crawled, pages in index, crawl errors and blocked/4xx/5xx counts per day. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg } },
    async ({ site, days }) => {
      const siteUrl = SITES[site].bingSiteUrl;
      if (!bingEnabled(siteUrl)) return err(`Bing Webmaster isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await bingCrawlStats(siteUrl, days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "gsc_traffic_by_day",
    { title: "Search Console traffic by day", description: `Google Search Console: organic search clicks, impressions, CTR and average position per day. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg } },
    async ({ site, days }) => {
      const siteUrl = SITES[site].gscSiteUrl;
      if (!gscEnabled(siteUrl)) return err(`Search Console isn't configured for ${SITES[site].label} yet — GOOGLE_SA_CLIENT_EMAIL/GOOGLE_SA_PRIVATE_KEY is missing, or the service account hasn't been added as a user on that property.`);
      try {
        return json(await gscTrafficByDay(siteUrl, days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "gsc_top_queries",
    { title: "Search Console top queries", description: `Google Search Console: top organic search queries by clicks over a date range, with impressions, CTR and average position. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(25) } },
    async ({ site, days, limit }) => {
      const siteUrl = SITES[site].gscSiteUrl;
      if (!gscEnabled(siteUrl)) return err(`Search Console isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await gscTopQueries(siteUrl, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "gsc_top_pages",
    { title: "Search Console top pages", description: `Google Search Console: top pages by organic search clicks over a date range, with impressions, CTR and average position. Covers: ${siteLabels}.`, inputSchema: { ...siteArg, ...daysArg, limit: limitArg(25) } },
    async ({ site, days, limit }) => {
      const siteUrl = SITES[site].gscSiteUrl;
      if (!gscEnabled(siteUrl)) return err(`Search Console isn't configured for ${SITES[site].label} yet.`);
      try {
        return json(await gscTopPages(siteUrl, days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  return server;
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="lusthentai-mcp"' } });
}

async function handle(req: Request): Promise<Response> {
  if (!TOKEN) return new Response("MCP_ACCESS_TOKEN not configured", { status: 503 });

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!presented || !tokenEqual(presented, TOKEN)) return unauthorized();

  // generous but real — this is a single-operator analytics tool, not a public endpoint
  if (!rateLimit(`mcp:${clientIp(req)}`, 60, 60_000)) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  // Stateless mode: a fresh server+transport per request. This is a serverless
  // function — there's no long-lived process to hold a session across calls,
  // and every tool here is a quick request/response with nothing to stream.
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  res.headers.append("Cache-Control", "no-store");
  return res;
}

export { handle as GET, handle as POST, handle as DELETE };
