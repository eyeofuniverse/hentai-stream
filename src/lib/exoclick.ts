import { prisma, db } from "@/lib/db";

/**
 * ExoClick revenue API — used by /console/revenue.
 *
 * Verified directly against the live API before building this (their docs
 * are behind a lossy GitBook AI-summary layer that kept truncating/guessing
 * paths, so real curl calls were more reliable): the permanent API token
 * this account has only carries scope for the Bidders/Campaigns
 * (advertiser-side) endpoints — it 401s on /v2/sites, /v2/zones, /v2/user.
 * Getting our own publisher stats requires a real username/password login,
 * which returns a 12h Bearer token. Cached in SocialToken (platform
 * "exoclick") — the same generic token-cache table used for any OAuth-style
 * credential pair — re-logging in on expiry rather than wiring up
 * ExoClick's separate (undocumented, untested) refresh-token flow; a plain
 * re-login is cheap and this page isn't hit often enough for that to matter.
 */

const BASE = "https://api.exoclick.com/v2";
const SITE_ID = Number(process.env.EXOCLICK_SITE_ID ?? "0");

async function login(): Promise<{ token: string; expiresIn: number }> {
  const username = process.env.EXOCLICK_USERNAME;
  const password = process.env.EXOCLICK_PASSWORD;
  if (!username || !password) throw new Error("EXOCLICK_USERNAME/EXOCLICK_PASSWORD not configured.");

  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`ExoClick login failed: ${res.status}`);
  const data = await res.json();
  return { token: data.token as string, expiresIn: (data.expires_in as number) ?? 43200 };
}

async function getToken(): Promise<string> {
  const cached = await db(() => prisma.socialToken.findUnique({ where: { platform: "exoclick" } }));
  if (cached && cached.expiresAt && cached.expiresAt > new Date()) return cached.accessToken;

  const { token, expiresIn } = await login();
  await db(() =>
    prisma.socialToken.upsert({
      where: { platform: "exoclick" },
      create: { platform: "exoclick", accessToken: token, expiresAt: new Date(Date.now() + expiresIn * 1000) },
      update: { accessToken: token, expiresAt: new Date(Date.now() + expiresIn * 1000) },
    }),
  );
  return token;
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`ExoClick API ${path} failed: ${res.status}`);
  return res.json();
}

export type ExoclickAccount = {
  id: number;
  username: string;
  balance: number;
  currency: string;
  email: string;
};

export async function getAccount(): Promise<ExoclickAccount> {
  const data = (await call("/user")) as { result: ExoclickAccount };
  return data.result;
}

export type ExoclickZone = {
  id: number;
  name: string;
  publisher_ad_type_label: string;
  size: string;
  active: 0 | 1;
};

export async function getZones(): Promise<ExoclickZone[]> {
  const data = (await call(`/zones?idsite=${SITE_ID}&limit=100`)) as { result: ExoclickZone[] };
  return data.result;
}

export type StatsRow = {
  impressions: number;
  clicks: number;
  revenue: number;
  cpm: number;
  /** Already a percentage (e.g. 0.86 means 0.86%), NOT a 0-1 fraction —
   *  confirmed against real clicks/impressions math. Display as-is with a
   *  "%" suffix; multiplying by 100 again produces nonsense (a zone with
   *  5/492 clicks showed as "101.63%" before this was caught). */
  ctr: number;
  group_by: Record<string, Record<string, string | number>>;
};

export async function getStats(opts: {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  groupBy: "date" | "zone_id";
}): Promise<StatsRow[]> {
  const data = (await call("/statistics/p/global", {
    method: "POST",
    body: JSON.stringify({
      group_by: [opts.groupBy],
      filter: { date_from: opts.dateFrom, date_to: opts.dateTo, site_id: [SITE_ID] },
      limit: 100,
      totals: 1,
    }),
  })) as { result: StatsRow[] };
  return data.result;
}

/** Extracts every ExoClick zone id actually referenced somewhere on the live
 *  site. There's no single column for this — each ad format embeds its zone
 *  id in a different shape within the raw HTML/JS: banner tags carry
 *  `data-zoneid="…"`, the popunder's own JS config object carries
 *  `"idzone": …` instead (verified by reading its actual stored code — the
 *  two don't share a pattern), and the VAST pre-roll tag lives outside the
 *  Ad table entirely, in Setting["vastAds"].tags as an `idz=…` query param. */
function extractZoneIds(text: string | null | undefined, ids: Set<number>): void {
  if (!text) return;
  for (const m of text.matchAll(/(?:data-zoneid="|"idzone":\s*|idz=)(\d+)/g)) {
    ids.add(Number(m[1]));
  }
}

async function usedZoneIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  const [ads, vastSetting] = await Promise.all([
    db(() => prisma.ad.findMany({ where: { type: "network" }, select: { networkCode: true } })),
    db(() => prisma.setting.findUnique({ where: { key: "vastAds" } })),
  ]);
  for (const ad of ads) extractZoneIds(ad.networkCode, ids);
  const vastTags = (vastSetting?.value as { tags?: string[] } | null)?.tags ?? [];
  for (const tag of vastTags) extractZoneIds(tag, ids);
  return ids;
}

export type ZoneReconciliation = {
  zone: ExoclickZone;
  usedOnSite: boolean;
};

/** Cross-references ExoClick's zone list against what's actually embedded in
 *  our Ad table, so unused/orphaned zones (configured but never wired in)
 *  surface instead of silently sitting there doing nothing. */
export async function reconcileZones(): Promise<ZoneReconciliation[]> {
  const [zones, used] = await Promise.all([getZones(), usedZoneIds()]);
  return zones.map((zone) => ({ zone, usedOnSite: used.has(zone.id) }));
}
