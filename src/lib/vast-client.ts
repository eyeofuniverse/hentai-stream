/**
 * Browser-side VAST resolver for the pre-roll (PreRollAd).
 *
 * Runs in the viewer's browser on purpose. An earlier version resolved the tag
 * on our server, which meant ExoClick saw a Vercel datacenter IP + a bot
 * User-Agent instead of the real viewer (wrong geo/device/frequency caps), and
 * it only kept the *final* InLine ad's pixels — ExoClick serves a Wrapper, and
 * the pixels that actually count (the impression and the 10-second "view")
 * live in that wrapper, so they were silently dropped.
 *
 * Per VAST 3.0 (and ExoClick's docs: "the video player must be Wrapper
 * compatible"), every hop's Impression / Error / Tracking / ClickTracking is
 * collected and fired by the player, alongside the InLine's own.
 */

export interface VastTracking {
  event: string;
  url: string;
  /** raw `offset` attr ("00:00:10.000" or "25%") — only meaningful for `progress` */
  offset: string | null;
}

export interface ResolvedAd {
  mediaUrl: string;
  durationSec: number | null;
  skipOffsetSec: number | null;
  /** every hop's <Impression> (wrapper(s) + inline), de-duplicated */
  impressions: string[];
  /** every hop's <Error>, with an [ERRORCODE] macro to fill */
  errors: string[];
  /** every hop's <Tracking> (creativeView/start/quartiles/progress/complete/…) */
  tracking: VastTracking[];
  clickThrough: string | null;
  clickTracking: string[];
}

const MAX_HOPS = 5;
const HOP_TIMEOUT_MS = 3000;
const PER_TAG_BUDGET_MS = 4000;
const TOTAL_BUDGET_MS = 6000;

/* ───────────────────────────── small helpers ───────────────────────────── */

/** "HH:MM:SS(.mmm)" -> seconds. */
export function parseClock(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!m) return null;
  const frac = raw.trim().match(/\.(\d+)$/);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (frac ? Number(`0.${frac[1]}`) : 0);
}

/** skipoffset / Tracking@offset: a clock time OR "NN%" of the duration. */
export function offsetToSec(raw: string | null | undefined, durationSec: number | null): number | null {
  if (!raw) return null;
  const pct = raw.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) return durationSec ? (Number(pct[1]) / 100) * durationSec : null;
  return parseClock(raw);
}

function clock(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${rest}`;
}

export interface MacroValues {
  errorCode?: number;
  playheadSec?: number;
  assetUri?: string;
}

/** Fill the standard VAST macros (bracketed or URL-encoded form). */
export function fillMacros(url: string, v: MacroValues = {}): string {
  const rep = (u: string, name: string, val: string) =>
    u.replace(new RegExp(`\\[${name}\\]|%5B${name}%5D`, "gi"), val);
  let out = url;
  out = rep(out, "ERRORCODE", String(v.errorCode ?? 900));
  out = rep(out, "TIMESTAMP", encodeURIComponent(new Date().toISOString()));
  out = rep(out, "CACHEBUSTING", String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  out = rep(out, "CONTENTPLAYHEAD", encodeURIComponent(clock(v.playheadSec ?? 0)));
  if (v.assetUri) out = rep(out, "ASSETURI", encodeURIComponent(v.assetUri));
  return out;
}

/** Fire-and-forget tracking beacon. `credentials: include` so the ad server's
 *  own cookies ride along, exactly as they would on an <img> pixel — that's
 *  what its frequency capping / viewer identity keys off. */
export function ping(url: string) {
  try {
    fetch(url, { mode: "no-cors", credentials: "include", keepalive: true, cache: "no-store" }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/* ───────────────────────────── resolution ───────────────────────────── */

type Acc = {
  impressions: string[];
  errors: string[];
  tracking: VastTracking[];
  clickTracking: string[];
};

type Ctx = { deadline: number; rewrite: (u: string) => string; acc: Acc };

const kids = (el: Element | null | undefined, name: string): Element[] =>
  el ? Array.from(el.children).filter((c) => c.localName === name) : [];
const child = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;
const txt = (el: Element | null | undefined) => el?.textContent?.trim() ?? "";
const push = (arr: string[], v: string) => v && arr.push(v);

async function fetchXml(url: string, ctx: Ctx): Promise<string | null> {
  const target = ctx.rewrite(url);
  // credentialed first (ExoClick and its wrapped ad servers both answer with
  // Allow-Credentials for our origin); plain retry only on a network/CORS
  // failure, never on a timeout or an HTTP error
  for (const credentials of ["include", "omit"] as const) {
    const remaining = ctx.deadline - Date.now();
    if (remaining < 300) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(HOP_TIMEOUT_MS, remaining));
    try {
      const res = await fetch(target, { credentials, signal: ctl.signal });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      if (ctl.signal.aborted) return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Wrapper/InLine common parts: Impression, Error, Linear tracking + clicks. */
function collect(node: Element, ctx: Ctx) {
  for (const el of kids(node, "Impression")) push(ctx.acc.impressions, txt(el));
  for (const el of kids(node, "Error")) push(ctx.acc.errors, txt(el));
  for (const creative of kids(child(node, "Creatives"), "Creative")) {
    const linear = child(creative, "Linear");
    if (!linear) continue;
    for (const t of kids(child(linear, "TrackingEvents"), "Tracking")) {
      const event = t.getAttribute("event") ?? "";
      const url = txt(t);
      if (event && url) ctx.acc.tracking.push({ event, url, offset: t.getAttribute("offset") });
    }
    for (const c of kids(child(linear, "VideoClicks"), "ClickTracking")) push(ctx.acc.clickTracking, txt(c));
  }
}

function failed(ctx: Ctx, code: number): null {
  // VAST §2.4.3.4: when the chain can't produce an ad, tell each hop's
  // Error URI why — ExoClick's wrapper carries one for its own fill stats
  for (const u of new Set(ctx.acc.errors)) ping(ctx.rewrite(fillMacros(u, { errorCode: code })));
  return null;
}

function pickMedia(linear: Element): { url: string; type: string } | null {
  const probe = typeof document !== "undefined" ? document.createElement("video") : null;
  const files = kids(child(linear, "MediaFiles"), "MediaFile")
    .map((el) => ({
      url: txt(el),
      type: (el.getAttribute("type") ?? "").toLowerCase(),
      bitrate: Number(el.getAttribute("bitrate") ?? el.getAttribute("maxBitrate") ?? 0),
      streaming: (el.getAttribute("delivery") ?? "progressive").toLowerCase() === "streaming",
    }))
    .filter((m) => /^https?:\/\//i.test(m.url) && !m.streaming)
    .filter((m) => !probe || !m.type || probe.canPlayType(m.type) !== "");
  if (!files.length) return null;
  const mp4 = files.filter((m) => m.type === "video/mp4");
  const pool = mp4.length ? mp4 : files;
  // highest bitrate that's still reasonable for a pre-roll on mobile data
  const ok = pool.filter((m) => !m.bitrate || m.bitrate <= 2000).sort((a, b) => b.bitrate - a.bitrate);
  return ok[0] ?? pool.sort((a, b) => a.bitrate - b.bitrate)[0];
}

async function resolveTag(url: string, ctx: Ctx, hop: number): Promise<ResolvedAd | null> {
  if (hop >= MAX_HOPS) return failed(ctx, 302);
  const xml = await fetchXml(url, ctx);
  if (!xml) return failed(ctx, 301);

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) return failed(ctx, 100);

  // one ad per response (ExoClick: "supports one ad per VAST response")
  const ad = doc.getElementsByTagName("Ad")[0];
  if (!ad) return failed(ctx, 303);

  const wrapper = child(ad, "Wrapper");
  if (wrapper) {
    collect(wrapper, ctx);
    const next = txt(child(wrapper, "VASTAdTagURI"));
    if (!next) return failed(ctx, 303);
    return resolveTag(next, ctx, hop + 1);
  }

  const inline = child(ad, "InLine");
  if (!inline) return failed(ctx, 303);
  collect(inline, ctx);

  let linear: Element | null = null;
  for (const creative of kids(child(inline, "Creatives"), "Creative")) {
    const l = child(creative, "Linear");
    if (l && child(l, "MediaFiles")) {
      linear = l;
      break;
    }
  }
  if (!linear) return failed(ctx, 401);
  const media = pickMedia(linear);
  if (!media) return failed(ctx, 403);

  const durationSec = parseClock(txt(child(linear, "Duration")));
  const uniq = (a: string[]) => [...new Set(a)];
  const seen = new Set<string>();
  const tracking = ctx.acc.tracking.filter((t) => {
    const k = `${t.event}|${t.offset}|${t.url}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });

  return {
    mediaUrl: media.url,
    durationSec,
    skipOffsetSec: offsetToSec(linear.getAttribute("skipoffset"), durationSec),
    impressions: uniq(ctx.acc.impressions),
    errors: uniq(ctx.acc.errors),
    tracking,
    clickThrough: txt(child(child(linear, "VideoClicks"), "ClickThrough")) || null,
    clickTracking: uniq(ctx.acc.clickTracking),
  };
}

/**
 * Try each tag in order (a waterfall) until one resolves to a playable ad,
 * inside one overall time budget so a dead/slow chain never meaningfully
 * delays the real video. `rewrite` swaps ExoClick hosts for the adblock-
 * recovery domain (see adblock-rewrite.ts) for viewers running a blocker.
 */
export async function resolveVast(
  tags: string[],
  opts: { rewrite?: (u: string) => string } = {},
): Promise<ResolvedAd | null> {
  const total = Date.now() + TOTAL_BUDGET_MS;
  for (const tag of tags) {
    if (Date.now() >= total - 300) break;
    const ctx: Ctx = {
      deadline: Math.min(total, Date.now() + PER_TAG_BUDGET_MS),
      rewrite: opts.rewrite ?? ((u) => u),
      acc: { impressions: [], errors: [], tracking: [], clickTracking: [] },
    };
    const ad = await resolveTag(tag, ctx, 0).catch(() => null);
    if (ad) return ad;
  }
  return null;
}
