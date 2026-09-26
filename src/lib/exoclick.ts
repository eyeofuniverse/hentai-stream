import { prisma, db } from "@/lib/db";

/**
 * ExoClick revenue API — used by /console/revenue and the daily report cron.
 *
 * Verified directly against the live API before building this (their docs
 * are behind a lossy GitBook AI-summary layer that kept truncating/guessing
 * paths, so real curl calls were more reliable): the permanent API token
 * this account has only carries scope for the Bidders/Campaigns
 * (advertiser-side) endpoints — it 401s on /v2/sites, /v2/zones, /v2/user.
 * Getting our own publisher stats requires a real login.
 *
 * The account has 2FA enabled (TOTP), so POST /login with just
 * username+password no longer returns a usable Bearer token — it returns a
 * `{type:"2FA", token:<challenge>}` that needs a live authenticator code to
 * complete, which nothing automated has access to. That makes the refresh
 * token the ONLY thing that can keep this working unattended: once 2FA is
 * completed one time (by hand — see the console flow this was originally
 * verified through), POST /login/two-factor-auth returns a normal 12h
 * Bearer token *plus* a refresh_token valid for a full year. Confirmed live:
 * POST /login/refresh — with the *expired* access token still sent as the
 * `Authorization: Bearer` header (not just the refresh_token in the body,
 * which 400s alone with "Invalid access token supplied") — returns a fresh
 * 12h token AND a new year-long refresh_token, so this chains indefinitely
 * without ever needing a live 2FA code again, as long as something actually
 * calls getToken() at least once before the stored refresh_token itself
 * expires (a year is generous, but this isn't literally "forever").
 *
 * Cached in SocialToken (platform "exoclick") — the same generic
 * token-cache table used for any OAuth-style credential pair.
 */

const BASE = "https://api.exoclick.com/v2";
const SITE_ID = Number(process.env.EXOCLICK_SITE_ID ?? "0");

async function saveToken(token: string, refreshToken: string, expiresIn: number): Promise<void> {
  await db(() =>
    prisma.socialToken.upsert({
      where: { platform: "exoclick" },
      create: { platform: "exoclick", accessToken: token, refreshToken, expiresAt: new Date(Date.now() + expiresIn * 1000) },
      update: { accessToken: token, refreshToken, expiresAt: new Date(Date.now() + expiresIn * 1000) },
    }),
  );
}

/** Refreshes using a (possibly already-expired) access token + its
 *  refresh_token. Throws if ExoClick rejects it (e.g. the year-long
 *  refresh_token itself finally expired) — the caller has no automated
 *  fallback at that point; someone needs to complete a fresh 2FA login by
 *  hand and re-seed SocialToken, same as the very first setup. */
async function refresh(oldAccessToken: string, refreshToken: string): Promise<{ token: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(`${BASE}/login/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${oldAccessToken}` },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ExoClick token refresh failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return {
    token: data.token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: (data.expires_in as number) ?? 43200,
  };
}

async function getToken(): Promise<string> {
  const cached = await db(() => prisma.socialToken.findUnique({ where: { platform: "exoclick" } }));
  if (cached && cached.expiresAt && cached.expiresAt > new Date()) return cached.accessToken;

  if (!cached?.refreshToken) {
    throw new Error(
      "ExoClick has no cached refresh token — 2FA requires a live authenticator code, which nothing " +
        "automated has. Complete a login/two-factor-auth by hand and seed SocialToken (platform=exoclick) once.",
    );
  }
  const { token, refreshToken, expiresIn } = await refresh(cached.accessToken, cached.refreshToken);
  await saveToken(token, refreshToken, expiresIn);
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
  /** In-stream (VAST) video ads: impressions = play starts, views = the paid event
   *  (10s of playback). Present on every row, zeros when the row had no video. */
  video?: { impressions: number; views: number };
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
