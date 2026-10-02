import "server-only";
import { prisma, db } from "@/lib/db";

// ── Traffic / referrer types ────────────────────────────────────────────────
export type TrafficSource = { source: string; category: string; count: number; pct: number };
export type TopReferrer = { domain: string; count: number; pct: number };
export type DeviceStat = { device: string; count: number; pct: number };
export type HourStat = { hour: number; count: number };
export type TopPage = { path: string; count: number };

export type TrafficData = {
  totalVisits: number;
  sources: TrafficSource[];
  topReferrers: TopReferrer[];
  topPages: TopPage[];
  devices: DeviceStat[];
  peakHours: HourStat[];
  /** visits per calendar day (UTC) across the range — every day filled in,
   *  including zero-visit ones, same as VisitorData.dailyTraffic. */
  dailyTraffic: DailyTraffic[];
  days: number;
  /** true when the date range holds more rows than the query cap — every
   *  metric below is computed from only the most recent `totalVisits` of
   *  them, not the full range. Narrow the range to get exact numbers. */
  truncated: boolean;
};

// Primary production host + current Vercel deployment URL, so a preview
// deploy sharing traffic with itself is still classified as "Internal".
const SITE_HOSTS: string[] = ["lusthentai.com"];
if (process.env.VERCEL_URL) SITE_HOSTS.push(process.env.VERCEL_URL);
if (process.env.NEXT_PUBLIC_SITE_URL) {
  SITE_HOSTS.push(
    process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "").split("/")[0],
  );
}

function classifyReferrer(referrer: string | null): { source: string; category: string } {
  if (!referrer) return { source: "Direct", category: "direct" };
  try {
    const host = new URL(referrer).hostname.replace(/^www\./i, "").toLowerCase();
    if (SITE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)))
      return { source: "Internal", category: "internal" };
    if (/google\./i.test(host)) return { source: "Google", category: "search" };
    if (/bing\.com/i.test(host)) return { source: "Bing", category: "search" };
    if (/yandex\./i.test(host)) return { source: "Yandex", category: "search" };
    if (/duckduckgo\.com/i.test(host)) return { source: "DuckDuckGo", category: "search" };
    if (/yahoo\./i.test(host)) return { source: "Yahoo", category: "search" };
    if (/baidu\.com/i.test(host)) return { source: "Baidu", category: "search" };
    if (/twitter\.com|x\.com/i.test(host)) return { source: "Twitter / X", category: "social" };
    if (/facebook\.com|fb\.com/i.test(host)) return { source: "Facebook", category: "social" };
    if (/reddit\.com/i.test(host)) return { source: "Reddit", category: "social" };
    if (/pinterest\./i.test(host)) return { source: "Pinterest", category: "social" };
    if (/tiktok\.com/i.test(host)) return { source: "TikTok", category: "social" };
    if (/instagram\.com/i.test(host)) return { source: "Instagram", category: "social" };
    if (/t\.me|telegram\./i.test(host)) return { source: "Telegram", category: "social" };
    if (/tumblr\.com/i.test(host)) return { source: "Tumblr", category: "social" };
    if (/exoclick\.com|juicyads\.com|trafficjunky\.com|eroadvertising\.com/i.test(host))
      return { source: host, category: "ad-network" };
    return { source: host, category: "referral" };
  } catch {
    return { source: "Direct", category: "direct" };
  }
}

type VisitRow = {
  path: string;
  referrer?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  visitedAt: Date;
};

const TRAFFIC_ROW_CAP = 20000;

export async function getTrafficAnalytics(days: number): Promise<TrafficData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [visits, trueTotal] = await db(() =>
    Promise.all([
      prisma.pageVisit.findMany({
        where: { visitedAt: { gte: since } },
        select: { path: true, referrer: true, deviceType: true, userAgent: true, visitedAt: true },
        orderBy: { visitedAt: "desc" },
        take: TRAFFIC_ROW_CAP,
      }),
      prisma.pageVisit.count({ where: { visitedAt: { gte: since } } }),
    ]),
  );

  const total = visits.length;
  const truncated = trueTotal > TRAFFIC_ROW_CAP;

  const sourceMap = new Map<string, { category: string; count: number }>();
  const referrerDomainMap = new Map<string, number>();
  const pageMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const hourBuckets = new Array(24).fill(0) as number[];

  for (const visit of visits) {
    const { source, category } = classifyReferrer(visit.referrer ?? null);
    const existing = sourceMap.get(source);
    if (existing) existing.count++;
    else sourceMap.set(source, { category, count: 1 });

    if (visit.referrer != null && category !== "internal") {
      // normalize www so reddit.com and www.reddit.com merge into one row
      const normalizedRef = visit.referrer.replace(/^(https?:\/\/)www\./i, "$1");
      referrerDomainMap.set(normalizedRef, (referrerDomainMap.get(normalizedRef) ?? 0) + 1);
    }

    pageMap.set(visit.path, (pageMap.get(visit.path) ?? 0) + 1);

    let device = visit.deviceType ?? "unknown";
    if (device === "unknown" && visit.userAgent) {
      const ua = visit.userAgent;
      if (/tablet|ipad/i.test(ua)) device = "tablet";
      else if (/mobile|iphone|ipod|android/i.test(ua)) device = "mobile";
      else device = "desktop";
    }
    deviceMap.set(device, (deviceMap.get(device) ?? 0) + 1);

    hourBuckets[new Date(visit.visitedAt).getUTCHours()]++;
  }

  const sources: TrafficSource[] = [...sourceMap.entries()]
    .map(([source, { category, count }]) => ({
      source,
      category,
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topReferrers: TopReferrer[] = [...referrerDomainMap.entries()]
    .map(([domain, count]) => ({
      domain,
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const topPages: TopPage[] = [...pageMap.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const deviceTotal = [...deviceMap.values()].reduce((s, n) => s + n, 0);
  const devices: DeviceStat[] = [...deviceMap.entries()]
    .map(([device, count]) => ({
      device,
      count,
      pct: deviceTotal > 0 ? Math.round((count / deviceTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const peakHours: HourStat[] = hourBuckets.map((count, hour) => ({ hour, count }));

  // day-by-day trend (UTC) — fill every day in range, including zero-visit
  // ones, same approach as getVisitorData's dailyTraffic.
  const dayMap = new Map<string, number>();
  for (const v of visits) {
    const day = new Date(v.visitedAt).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const dailyTraffic: DailyTraffic[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyTraffic.push({ date: key, visits: dayMap.get(key) ?? 0 });
  }

  return {
    totalVisits: total,
    sources,
    topReferrers,
    topPages,
    devices,
    peakHours,
    dailyTraffic,
    days,
    truncated,
  };
}

// All dates go out as ISO strings — plain data crossing the server/client
// boundary, never a Date object a client component has to re-hydrate.
export type VisitorGroup = {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  paths: string[];
  visitCount: number;
  firstSeen: string;
  lastSeen: string;
  /** avg seconds/page for this visitor, over pages that reported a duration
   *  — null if none of their page views have finished reporting one yet. */
  avgDurationSec: number | null;
  /** total seconds spent across every page view in range that reported a
   *  duration — null if none has yet. Same caveat as avgDurationSec: pages
   *  still open (or whose leave beacon never landed) aren't counted, so this
   *  is a floor on real time spent, not an exact figure. */
  totalDurationSec: number | null;
};

export type DailyTraffic = { date: string; visits: number };
export type CountryStat = { country: string; countryCode: string | null; count: number };

export type RecentVisit = {
  id: string;
  ip: string;
  country: string | null;
  countryCode: string | null;
  path: string;
  visitedAt: string;
  /** seconds spent on this page — null if the beacon reporting it (sent on
   *  leaving the page) never made it out, or it's mid-visit right now. */
  durationSec: number | null;
};

export type VisitorData = {
  totalVisits: number;
  uniqueVisitors: number;
  onlineNow: number;
  avgPagesPerVisitor: number;
  /** avg seconds/page across every page view that has reported a duration. */
  avgDurationSec: number | null;
  topCountry: string | null;
  topCountries: CountryStat[];
  visitors: VisitorGroup[];
  topPages: TopPage[];
  recentVisits: RecentVisit[];
  dailyTraffic: DailyTraffic[];
  days: number;
  /** true when the date range holds more rows than the query cap — see
   *  TrafficData.truncated for what this means for the numbers below. */
  truncated: boolean;
};

type IpApiResult = {
  query: string;
  status: string;
  country?: string;
  countryCode?: string;
  city?: string;
};

/** Resolve IPs not already in IpGeoCache via ip-api.com's free batch endpoint
 *  (no key, 45 req/min), caching every result — including misses — so a dud
 *  IP isn't re-queried forever. Best-effort: any failure just leaves geo null. */
async function resolveGeo(
  uncachedIps: string[],
): Promise<Map<string, { country: string | null; countryCode: string | null; city: string | null }>> {
  const map = new Map<string, { country: string | null; countryCode: string | null; city: string | null }>();
  if (uncachedIps.length === 0) return map;

  const ipsToResolve = uncachedIps.slice(0, 300);
  for (let i = 0; i < ipsToResolve.length; i += 100) {
    const batch = ipsToResolve.slice(i, i + 100);
    try {
      const res = await fetch("http://ip-api.com/batch?fields=query,status,country,countryCode,city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((ip) => ({ query: ip }))),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const results: IpApiResult[] = await res.json();
      const upserts = results
        .filter((r) => r.query)
        .map((r) => {
          const geo = {
            country: r.status === "success" ? (r.country ?? null) : null,
            countryCode: r.status === "success" ? (r.countryCode ?? null) : null,
            city: r.status === "success" ? (r.city ?? null) : null,
          };
          map.set(r.query, geo);
          return prisma.ipGeoCache.upsert({
            where: { ip: r.query },
            create: { ip: r.query, ...geo },
            update: geo,
          });
        });
      if (upserts.length > 0) await db(() => prisma.$transaction(upserts));
    } catch {
      // non-fatal — those IPs just render as "Unknown" this time around
    }
  }
  return map;
}

function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val);
}

const VISITOR_ROW_CAP = 10000;
// The "Activity" tab only ever shows the most recent handful of hits, so it
// gets its own small, index-backed query (visitedAt DESC LIMIT 20) instead of
// riding on the big VISITOR_ROW_CAP fetch below — that fetch is the one that
// was actually straining the DB on every admin page load.
const RECENT_VISITS_CAP = 20;

export async function getVisitorData(days = 7): Promise<VisitorData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [visits, trueTotal, recentRaw] = await db(() =>
    Promise.all([
      prisma.pageVisit.findMany({
        where: { visitedAt: { gte: since } },
        orderBy: { visitedAt: "desc" },
        take: VISITOR_ROW_CAP,
        select: { id: true, ip: true, path: true, visitedAt: true, durationSec: true },
      }),
      prisma.pageVisit.count({ where: { visitedAt: { gte: since } } }),
      prisma.pageVisit.findMany({
        where: { visitedAt: { gte: since } },
        orderBy: { visitedAt: "desc" },
        take: RECENT_VISITS_CAP,
        select: { id: true, ip: true, path: true, visitedAt: true, durationSec: true },
      }),
    ]),
  );
  const truncated = trueTotal > VISITOR_ROW_CAP;

  const uniqueIps = [...new Set(visits.map((v) => v.ip))].filter(
    (ip) => ip !== "unknown" && ip !== "0.0.0.0",
  );

  const cachedGeo = uniqueIps.length > 0
    ? await db(() => prisma.ipGeoCache.findMany({ where: { ip: { in: uniqueIps } } }))
    : [];

  const geoMap = new Map(cachedGeo.map((g) => [g.ip, g]));
  const uncachedIps = uniqueIps.filter((ip) => !geoMap.has(ip));
  if (uncachedIps.length > 0) {
    const resolved = await resolveGeo(uncachedIps);
    for (const [ip, geo] of resolved) geoMap.set(ip, { ip, ...geo, cachedAt: new Date() });
  }

  // recentRaw's IPs are almost always already in geoMap (same recency
  // window, much smaller take) — this only resolves the rare edge case where
  // it isn't, never re-fetches the ones it already has.
  const recentUncachedIps = [...new Set(recentRaw.map((v) => v.ip))].filter(
    (ip) => ip !== "unknown" && ip !== "0.0.0.0" && !geoMap.has(ip),
  );
  if (recentUncachedIps.length > 0) {
    const resolved = await resolveGeo(recentUncachedIps);
    for (const [ip, geo] of resolved) geoMap.set(ip, { ip, ...geo, cachedAt: new Date() });
  }

  // Build visitor SESSIONS, not one row per IP. Grouping by bare IP (the old
  // behavior) meant every page view from the same address across the whole
  // lookback window — today's visit and one from five days ago alike —
  // landed in a single merged row, so time-spent and pages-per-visit were
  // sums/averages across unrelated visits instead of real per-visit figures.
  // Split on inactivity instead: a gap of this long between two page views
  // from the same IP starts a new session (same threshold ViewPing already
  // uses client-side for "is this still the same visit").
  const SESSION_GAP_MS = 30 * 60 * 1000;

  const byIp = new Map<string, typeof visits>();
  for (const v of visits) {
    const arr = byIp.get(v.ip);
    if (arr) arr.push(v);
    else byIp.set(v.ip, [v]);
  }

  const visitorMap = new Map<string, VisitorGroup>(); // keyed by "ip::sessionStartMs"
  const onlineIps = new Set<string>();
  // durationSec is only known once a page view has actually finished (see
  // PageTracker) — accumulate sum/count per session separately so the
  // average only counts pages that have reported one, not every page view.
  const durationAcc = new Map<string, { sum: number; count: number }>();
  let globalDurationSum = 0;
  let globalDurationCount = 0;

  for (const [ip, ipVisits] of byIp) {
    const geo = geoMap.get(ip);
    // oldest-first so the gap check below walks forward through real time
    const chrono = [...ipVisits].sort(
      (a, b) => toDate(a.visitedAt as Date | string).getTime() - toDate(b.visitedAt as Date | string).getTime(),
    );
    let sessionKey = "";
    let lastTs = -Infinity;
    for (const v of chrono) {
      const vDate = toDate(v.visitedAt as Date | string);
      const ts = vDate.getTime();
      const visitedAt = vDate.toISOString();
      if (ts - lastTs > SESSION_GAP_MS) {
        sessionKey = `${ip}::${ts}`;
        visitorMap.set(sessionKey, {
          ip,
          country: geo?.country ?? null,
          countryCode: geo?.countryCode ?? null,
          city: geo?.city ?? null,
          paths: [v.path],
          visitCount: 1,
          firstSeen: visitedAt,
          lastSeen: visitedAt,
          avgDurationSec: null,
          totalDurationSec: null,
        });
      } else {
        const existing = visitorMap.get(sessionKey)!;
        if (!existing.paths.includes(v.path)) existing.paths.push(v.path);
        existing.visitCount++;
        existing.lastSeen = visitedAt; // chronological order, so this only ever advances
      }
      lastTs = ts;

      if (v.durationSec != null) {
        const acc = durationAcc.get(sessionKey) ?? { sum: 0, count: 0 };
        acc.sum += v.durationSec;
        acc.count++;
        durationAcc.set(sessionKey, acc);
        globalDurationSum += v.durationSec;
        globalDurationCount++;
      }
      if (ts >= fiveMinutesAgo.getTime()) onlineIps.add(ip);
    }
  }
  const onlineNow = onlineIps.size;

  for (const [key, group] of visitorMap) {
    const acc = durationAcc.get(key);
    group.avgDurationSec = acc ? Math.round(acc.sum / acc.count) : null;
    group.totalDurationSec = acc ? acc.sum : null;
  }
  const avgDurationSec = globalDurationCount > 0 ? Math.round(globalDurationSum / globalDurationCount) : null;

  // daily traffic — fill every day in range, including zero-visit days
  const dayMap = new Map<string, number>();
  for (const v of visits) {
    const day = toDate(v.visitedAt as Date | string).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const dailyTraffic: DailyTraffic[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyTraffic.push({ date: key, visits: dayMap.get(key) ?? 0 });
  }

  const pageHitMap = new Map<string, number>();
  for (const v of visits) pageHitMap.set(v.path, (pageHitMap.get(v.path) ?? 0) + 1);
  const topPages = [...pageHitMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));

  // By distinct IP, not by session — a visitor who came back three times
  // today is still one person for "top countries" purposes, not three.
  const countryMap = new Map<string, { count: number; countryCode: string | null }>();
  for (const ip of byIp.keys()) {
    const geo = geoMap.get(ip);
    if (geo?.country) {
      const e = countryMap.get(geo.country);
      if (e) e.count++;
      else countryMap.set(geo.country, { count: 1, countryCode: geo.countryCode });
    }
  }
  const topCountries = [...countryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([country, { count, countryCode }]) => ({ country, countryCode, count }));

  const topCountry = topCountries[0]?.country ?? null;

  // Pages per *visit*: total page views over total sessions, now that a
  // returning visitor contributes multiple distinct sessions instead of
  // inflating one merged row's page count.
  const avgPagesPerVisitor =
    visitorMap.size > 0 ? Math.round((visits.length / visitorMap.size) * 10) / 10 : 0;

  const recentVisits: RecentVisit[] = recentRaw.map((v) => {
    const geo = geoMap.get(v.ip);
    return {
      id: v.id,
      ip: v.ip,
      country: geo?.country ?? null,
      countryCode: geo?.countryCode ?? null,
      path: v.path,
      visitedAt: toDate(v.visitedAt as Date | string).toISOString(),
      durationSec: v.durationSec,
    };
  });

  return {
    totalVisits: visits.length,
    uniqueVisitors: byIp.size,
    onlineNow,
    avgPagesPerVisitor,
    avgDurationSec,
    topCountry,
    topCountries,
    visitors: [...visitorMap.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    topPages,
    recentVisits,
    dailyTraffic,
    days,
    truncated,
  };
}
