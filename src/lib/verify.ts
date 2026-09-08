import { prisma, db } from "@/lib/db";
import type { SourceStatus } from "@prisma/client";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface CheckResult {
  status: SourceStatus; // ACTIVE | DEAD | REJECTED
  reason: string;
}

/**
 * Can a browser on OUR domain actually play this source?
 *   direct file  → a range request must return 200/206 + video bytes
 *   iframe embed → 200 and no X-Frame-Options / restrictive frame-ancestors
 * We send no Referer (or our own) so a source that needs the origin site's
 * referer correctly fails here, just like it would in the viewer's browser.
 */
export async function checkUrl(url: string, direct: boolean): Promise<CheckResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "user-agent": UA,
        ...(direct ? { range: "bytes=0-2047" } : { accept: "text/html,*/*" }),
      },
    });
  } catch (e) {
    return { status: "DEAD", reason: `fetch failed: ${(e as Error).message}` };
  }

  if (res.status === 403 || res.status === 401) {
    return { status: "REJECTED", reason: `${res.status} — likely referer/token locked` };
  }
  if (res.status === 404 || res.status === 410) {
    return { status: "DEAD", reason: `${res.status} gone` };
  }
  if (!res.ok && res.status !== 206) {
    return { status: "DEAD", reason: `HTTP ${res.status}` };
  }

  if (direct) {
    const ct = res.headers.get("content-type") ?? "";
    const okType =
      /^(video\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|octet-stream|dash\+xml))/i.test(ct) ||
      /\.(mp4|m3u8|webm|mkv)(\?|$)/i.test(url);
    if (!okType) return { status: "DEAD", reason: `not a video (content-type: ${ct || "?"})` };
    const len = Number(res.headers.get("content-length") ?? res.headers.get("content-range")?.split("/")[1] ?? 0);
    if (res.status === 206 || len > 100_000 || res.headers.get("accept-ranges")) {
      return { status: "ACTIVE", reason: "streamable" };
    }
    return { status: "ACTIVE", reason: "playable (no range info)" };
  }

  // iframe embed
  const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) {
    return { status: "REJECTED", reason: `X-Frame-Options: ${xfo}` };
  }
  const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
  const fa = csp.match(/frame-ancestors ([^;]+)/)?.[1] ?? "";
  if (fa && !fa.includes("*") && !fa.includes("https:")) {
    return { status: "REJECTED", reason: `CSP frame-ancestors: ${fa.trim()}` };
  }
  return { status: "ACTIVE", reason: "embeddable" };
}

/** Publish an episode if it has a live source, and its series if it has a live
 *  episode — respecting the possible-minor gate. Used by verify + ingest. */
export async function publishIfLive(episodeId: string): Promise<{
  episodePublished: boolean;
  seriesPublished: boolean;
}> {
  const ep = await db(() =>
    prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        publish: true,
        seriesId: true,
        series: { select: { publish: true, contentWarnings: true } },
        _count: { select: { sources: { where: { status: "ACTIVE" } } } },
      },
    }),
  );
  if (!ep) return { episodePublished: false, seriesPublished: false };

  const blocked = ep.series.contentWarnings.includes("possible-minor");
  let episodePublished = false;
  let seriesPublished = false;

  if (!blocked && ep._count.sources > 0 && ep.publish !== "PUBLISHED") {
    await db(() =>
      prisma.episode.update({ where: { id: episodeId }, data: { publish: "PUBLISHED" } }),
    );
    episodePublished = true;
  } else if (blocked || ep._count.sources === 0) {
    if (ep.publish === "PUBLISHED") {
      await db(() =>
        prisma.episode.update({ where: { id: episodeId }, data: { publish: "DRAFT" } }),
      );
    }
  }

  if (!blocked && ep.series.publish === "DRAFT") {
    const live = await db(() =>
      prisma.episode.count({ where: { seriesId: ep.seriesId, publish: "PUBLISHED" } }),
    );
    if (live > 0) {
      await db(() =>
        prisma.series.update({
          where: { id: ep.seriesId },
          data: { publish: "PUBLISHED", autoPublishedAt: new Date(), reviewedAt: null },
        }),
      );
      seriesPublished = true;
    }
  }
  return { episodePublished, seriesPublished };
}

export interface VerifySummary {
  checked: number;
  active: number;
  dead: number;
  rejected: number;
  episodesPublished: number;
  seriesPublished: number;
  tookMs: number;
}

/**
 * Walk video sources, check each is actually streamable, set its status, then
 * (re)apply the publish rules. Pass `all` to re-check everything; otherwise only
 * PENDING + sources not checked in the last 3 days.
 */
export async function runVerify(opts: {
  all?: boolean;
  limit?: number;
  gapMs?: number;
  log?: (m: string) => void;
}): Promise<VerifySummary> {
  const log = opts.log ?? (() => {});
  const started = Date.now();
  const staleBefore = new Date(Date.now() - 3 * 864e5);

  const sources = await db(() =>
    prisma.videoSource.findMany({
      where: opts.all
        ? {}
        : {
            // scraped sources only — manual ones are the admin's to manage
            sourceSite: { not: null },
            OR: [
              { status: "PENDING" },
              { lastCheckedAt: null },
              { lastCheckedAt: { lt: staleBefore } },
            ],
          },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 5000,
      select: { id: true, embedUrl: true, direct: true, status: true, episodeId: true, checkFailCount: true },
    }),
  );
  log(`verify: ${sources.length} sources to check`);

  const s: VerifySummary = {
    checked: 0,
    active: 0,
    dead: 0,
    rejected: 0,
    episodesPublished: 0,
    seriesPublished: 0,
    tookMs: 0,
  };
  const touchedEpisodes = new Set<string>();
  const gap = opts.gapMs ?? 150;

  for (const src of sources) {
    const r = await checkUrl(src.embedUrl, src.direct);
    s.checked++;
    if (r.status === "ACTIVE") s.active++;
    else if (r.status === "REJECTED") s.rejected++;
    else s.dead++;

    await db(() =>
      prisma.videoSource.update({
        where: { id: src.id },
        data: {
          status: r.status,
          lastCheckedAt: new Date(),
          checkFailCount: r.status === "ACTIVE" ? 0 : src.checkFailCount + 1,
        },
      }),
    );
    touchedEpisodes.add(src.episodeId);
    if (s.checked % 50 === 0) log(`  … ${s.checked}/${sources.length}`);
    if (gap) await new Promise((res) => setTimeout(res, gap));
  }

  for (const epId of touchedEpisodes) {
    const p = await publishIfLive(epId);
    if (p.episodePublished) s.episodesPublished++;
    if (p.seriesPublished) s.seriesPublished++;
  }

  s.tookMs = Date.now() - started;
  return s;
}
