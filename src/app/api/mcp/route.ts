import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { tokenEqual } from "@/lib/admin/gate";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { ga4Enabled, ga4TrafficByDay, ga4TopPages, ga4TrafficSources, ga4Audience } from "@/lib/mcp/google-analytics";
import { bingEnabled, bingTrafficByDay, bingTopQueries, bingTopPages, bingCrawlStats } from "@/lib/mcp/bing-webmaster";

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

const daysArg = { days: z.number().int().min(1).max(180).default(30).describe("How many days back from today") };
const limitArg = (def: number) => z.number().int().min(1).max(100).default(def).describe("Max rows to return");

function buildServer(): McpServer {
  const server = new McpServer({ name: "lusthentai-analytics", version: "1.0.0" });

  server.registerTool(
    "ga4_traffic_by_day",
    { title: "GA4 traffic by day", description: "Google Analytics 4: sessions, active users, page views and engagement rate per day for lusthentai.com.", inputSchema: daysArg },
    async ({ days }) => {
      if (!ga4Enabled()) return err("GA4 isn't configured yet — GA4_PROPERTY_ID, GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY is missing.");
      try {
        return json(await ga4TrafficByDay(days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_top_pages",
    { title: "GA4 top pages", description: "Google Analytics 4: top pages by page views over a date range, with active users and engagement rate.", inputSchema: { ...daysArg, limit: limitArg(20) } },
    async ({ days, limit }) => {
      if (!ga4Enabled()) return err("GA4 isn't configured yet — GA4_PROPERTY_ID, GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY is missing.");
      try {
        return json(await ga4TopPages(days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_traffic_sources",
    { title: "GA4 traffic sources", description: "Google Analytics 4: sessions broken down by channel group and source (organic search, direct, referral, etc.).", inputSchema: { ...daysArg, limit: limitArg(15) } },
    async ({ days, limit }) => {
      if (!ga4Enabled()) return err("GA4 isn't configured yet — GA4_PROPERTY_ID, GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY is missing.");
      try {
        return json(await ga4TrafficSources(days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "ga4_audience",
    { title: "GA4 audience shape", description: "Google Analytics 4: sessions by device category and by country over a date range.", inputSchema: daysArg },
    async ({ days }) => {
      if (!ga4Enabled()) return err("GA4 isn't configured yet — GA4_PROPERTY_ID, GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY is missing.");
      try {
        return json(await ga4Audience(days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_traffic_by_day",
    { title: "Bing search traffic by day", description: "Bing Webmaster Tools: search clicks and impressions per day for lusthentai.com.", inputSchema: daysArg },
    async ({ days }) => {
      if (!bingEnabled()) return err("Bing Webmaster isn't configured yet — BING_WEBMASTER_API_KEY is missing.");
      try {
        return json(await bingTrafficByDay(days));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_top_queries",
    { title: "Bing top search queries", description: "Bing Webmaster Tools: top search queries by clicks over a date range, with impressions, CTR and average position.", inputSchema: { ...daysArg, limit: limitArg(25) } },
    async ({ days, limit }) => {
      if (!bingEnabled()) return err("Bing Webmaster isn't configured yet — BING_WEBMASTER_API_KEY is missing.");
      try {
        return json(await bingTopQueries(days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_top_pages",
    { title: "Bing top pages", description: "Bing Webmaster Tools: top pages by search clicks over a date range, with impressions, CTR and average position.", inputSchema: { ...daysArg, limit: limitArg(25) } },
    async ({ days, limit }) => {
      if (!bingEnabled()) return err("Bing Webmaster isn't configured yet — BING_WEBMASTER_API_KEY is missing.");
      try {
        return json(await bingTopPages(days, limit));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.registerTool(
    "bing_crawl_stats",
    { title: "Bing crawl & index stats", description: "Bing Webmaster Tools: pages crawled, pages in index, crawl errors and blocked/4xx/5xx counts per day.", inputSchema: daysArg },
    async ({ days }) => {
      if (!bingEnabled()) return err("Bing Webmaster isn't configured yet — BING_WEBMASTER_API_KEY is missing.");
      try {
        return json(await bingCrawlStats(days));
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
