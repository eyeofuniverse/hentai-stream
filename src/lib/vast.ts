import "server-only";
import * as cheerio from "cheerio";

/**
 * Resolves a VAST tag (following Wrapper redirects) to a normalized, playable
 * ad. Replaces Bunny's built-in VAST integration — see the plan this shipped
 * under for why: we needed a waterfall across multiple tags (Bunny only
 * supports one) and a themed player UI instead of Bunny's own.
 */
export interface ResolvedAd {
  mediaUrl: string;
  durationSec: number | null;
  skipOffsetSec: number | null;
  /** name -> firing checkpoint as a fraction of duration (0-1), except "skip"
   *  which fires on a user skip click, not playback progress */
  trackingEvents: { event: string; url: string; atFraction: number | null }[];
  impressionPixels: string[];
  errorPixels: string[];
  clickThrough: string | null;
  clickTracking: string[];
}

const MAX_HOPS = 3;
const HOP_TIMEOUT_MS = 2500;
const TOTAL_BUDGET_MS = 5000;

const QUARTILE_FRACTION: Record<string, number> = {
  start: 0,
  firstQuartile: 0.25,
  midpoint: 0.5,
  thirdQuartile: 0.75,
  complete: 1,
};

async function fetchXml(url: string, deadline: number): Promise<string | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 200) return null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; LustHentaiBot/1.0)" },
      signal: AbortSignal.timeout(Math.min(HOP_TIMEOUT_MS, remaining)),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** "HH:MM:SS(.mmm)" -> seconds. */
function parseClock(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** skipoffset / Tracking@offset can be a clock time OR a "NN%" percentage. */
function parseOffsetSec(raw: string | null | undefined, durationSec: number | null): number | null {
  if (!raw) return null;
  const pct = raw.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) {
    if (durationSec == null) return null;
    return Math.round((Number(pct[1]) / 100) * durationSec);
  }
  return parseClock(raw);
}

async function resolveOne(tagUrl: string, deadline: number, hop = 0): Promise<ResolvedAd | null> {
  if (hop >= MAX_HOPS) return null;
  const xml = await fetchXml(tagUrl, deadline);
  if (!xml) return null;

  const $ = cheerio.load(xml, { xmlMode: true });

  const wrapperUri = $("Wrapper VASTAdTagURI").first().text().trim();
  if (wrapperUri) return resolveOne(wrapperUri, deadline, hop + 1);

  const inline = $("InLine").first();
  if (!inline.length) return null; // no fill — the spec-compliant empty-VAST case

  const linear = inline.find("Linear").first();
  if (!linear.length) return null;

  const mediaFiles = linear
    .find("MediaFile")
    .toArray()
    .map((el) => {
      const $el = $(el);
      return { url: $el.text().trim(), type: ($el.attr("type") ?? "").toLowerCase() };
    })
    .filter((m) => /^https?:\/\//i.test(m.url));
  const best = mediaFiles.find((m) => m.type === "video/mp4") ?? mediaFiles[0];
  if (!best) return null;

  const durationSec = parseClock(inline.find("Duration").first().text().trim());
  const skipOffsetSec = parseOffsetSec(linear.attr("skipoffset"), durationSec);

  const trackingEvents = linear
    .find("Tracking")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const event = $el.attr("event") ?? "";
      const url = $el.text().trim();
      const atFraction =
        event in QUARTILE_FRACTION
          ? QUARTILE_FRACTION[event]
          : (() => {
              const sec = parseOffsetSec($el.attr("offset"), durationSec);
              return sec != null && durationSec ? sec / durationSec : null;
            })();
      return { event, url, atFraction };
    })
    .filter((t): t is { event: string; url: string; atFraction: number | null } => !!t.event && !!t.url);

  const impressionPixels = inline
    .find("Impression")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);
  const errorPixels = inline
    .find("Error")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);
  const clickThrough = linear.find("ClickThrough").first().text().trim() || null;
  const clickTracking = linear
    .find("ClickTracking")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);

  return {
    mediaUrl: best.url,
    durationSec,
    skipOffsetSec,
    trackingEvents,
    impressionPixels,
    errorPixels,
    clickThrough,
    clickTracking,
  };
}

/** Try each tag in order (a waterfall) until one resolves to a real playable
 *  ad, bounded by one overall time budget so a dead/slow chain never
 *  meaningfully delays real content. */
export async function resolveVast(tagUrls: string[]): Promise<ResolvedAd | null> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const tag of tagUrls) {
    if (Date.now() >= deadline) break;
    const ad = await resolveOne(tag, deadline).catch(() => null);
    if (ad) return ad;
  }
  return null;
}
