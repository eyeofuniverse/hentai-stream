import { createWriteStream } from "node:fs";
import { mkdtemp, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma, db } from "@/lib/db";
import { bunnyEnabled, createVideo, deleteVideo, uploadVideoFile } from "./bunny";
import { SITE_REFERER, usableSources, pollHosting } from "./migrate";

/**
 * Host episodes in Bunny by downloading the file OURSELVES and uploading it —
 * the fallback for source CDNs that refuse Bunny's fetch workers.
 *
 * hentaigasm's CDN (hgasm1/2/3.com) serves ordinary clients fine but started
 * rejecting Bunny's pull ("fetch" → status 6) after hours of continuous
 * pulling, leaving ~500 episodes failed. From a GitHub runner (datacentre
 * bandwidth, free egress and ingress) we can download the MP4 ourselves and PUT
 * the bytes to Bunny, which then transcodes it exactly like a fetched video.
 *
 *   npm run upload-host -- --site=hentaigasm --max-minutes=300
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const MIN_BYTES = 5 * 1024 * 1024; // anything smaller is an error page or a stub
const MAX_BYTES = 4 * 1024 ** 3;
const STALL_MS = 90_000; // no bytes for this long → abort the download
const DOWNLOAD_CAP_MS = 60 * 60_000;
const MAX_CONSECUTIVE_FAILS = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface UploadSummary {
  seen: number;
  uploaded: number;
  skipped: number;
  errors: string[];
  bytes: number;
  tookMs: number;
}

/** True when the first bytes look like a real container (MP4/MOV, Matroska/WebM, AVI) and not an HTML error page. */
async function looksLikeVideo(file: string): Promise<boolean> {
  const fh = await open(file, "r");
  try {
    const b = Buffer.alloc(12);
    await fh.read(b, 0, 12, 0);
    if (b.subarray(4, 8).toString("latin1") === "ftyp") return true; // mp4 / mov
    if (b.readUInt32BE(0) === 0x1a45dfa3) return true; // matroska / webm
    if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 11).toString("latin1") === "AVI") return true;
    return false;
  } finally {
    await fh.close();
  }
}

/** Stream a URL to disk. Aborts on a stalled connection, an oversized/undersized body or a non-video reply. */
export async function download(url: string, dest: string, referer?: string): Promise<number> {
  const ctl = new AbortController();
  const cap = setTimeout(() => ctl.abort(new Error("download exceeded time cap")), DOWNLOAD_CAP_MS);
  let stall: NodeJS.Timeout | undefined;
  const bump = () => {
    clearTimeout(stall);
    stall = setTimeout(() => ctl.abort(new Error(`download stalled ${STALL_MS / 1000}s`)), STALL_MS);
  };
  try {
    bump();
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...(referer ? { Referer: referer } : {}) },
      redirect: "follow",
      signal: ctl.signal,
    });
    if (res.status === 404 || res.status === 410) throw new Error(`source dead (HTTP ${res.status})`);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (/text\/html|json/i.test(ct)) throw new Error(`not a video (content-type ${ct})`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len && len < MIN_BYTES) throw new Error(`too small (${len} bytes)`);
    if (len > MAX_BYTES) throw new Error(`too large (${len} bytes)`);

    let got = 0;
    const src = Readable.fromWeb(res.body as never);
    src.on("data", (c: Buffer) => {
      got += c.length;
      bump();
      if (got > MAX_BYTES) src.destroy(new Error("body exceeds size cap"));
    });
    await pipeline(src, createWriteStream(dest));
    if (len && got !== len) throw new Error(`truncated download (${got}/${len} bytes)`);
    if (got < MIN_BYTES) throw new Error(`too small (${got} bytes)`);
    if (!(await looksLikeVideo(dest))) throw new Error("downloaded file is not a video container");
    return got;
  } finally {
    clearTimeout(cap);
    clearTimeout(stall);
  }
}

export async function runUploadHost(opts: {
  site?: string; // only sources from this site (default: hentaigasm)
  limit?: number;
  maxMinutes?: number;
  concurrency?: number;
  log?: (m: string) => void;
}): Promise<UploadSummary> {
  const log = opts.log ?? (() => {});
  if (!bunnyEnabled()) throw new Error("Bunny env not set");
  const site = opts.site ?? "hentaigasm";
  const started = Date.now();
  const deadline = started + (opts.maxMinutes ?? 300) * 60_000;
  const s: UploadSummary = { seen: 0, uploaded: 0, skipped: 0, errors: [], bytes: 0, tookMs: 0 };

  const episodes = await db(() =>
    prisma.episode.findMany({
      where: {
        kind: "MAIN",
        OR: [{ bunnyGuid: null }, { bunnyStatus: "failed" }],
        sources: { some: { sourceSite: site, direct: true, status: { not: "DEAD" } } },
      },
      orderBy: [{ series: { bayesianRating: "desc" } }, { createdAt: "asc" }],
      take: opts.limit ?? 1000,
      select: {
        id: true,
        number: true,
        bunnyGuid: true,
        series: { select: { title: true, contentWarnings: true } },
        sources: { select: { id: true, embedUrl: true, direct: true, status: true, sourceSite: true, quality: true } },
      },
    }),
  );
  log(`upload-host: ${episodes.length} ${site} episodes to consider`);

  const run = await db(() => prisma.hostRun.create({ data: {}, select: { id: true } })).catch(() => null);
  const tmp = await mkdtemp(path.join(tmpdir(), "uphost-"));
  let consecutiveFails = 0;
  let next = 0;

  async function one(ep: (typeof episodes)[number]): Promise<void> {
    if (ep.series.contentWarnings.includes("possible-minor")) {
      s.skipped++;
      return;
    }
    const srcs = usableSources(ep.sources).filter((x) => x.sourceSite === site);
    if (!srcs.length) {
      s.skipped++;
      return;
    }
    const label = `${ep.series.title} E${ep.number}`;
    let ok = false;
    let lastErr = "";
    for (const src of srcs) {
      const file = path.join(tmp, `${ep.id}.bin`);
      let guid: string | null = null;
      try {
        const t0 = Date.now();
        const bytes = await download(src.embedUrl, file, src.sourceSite ? SITE_REFERER[src.sourceSite] : undefined);
        const dlSec = (Date.now() - t0) / 1000;
        // claim the episode only now that we hold a good file, so a slow/bad
        // download never leaves a half-made Bunny video behind
        const video = await createVideo(`${ep.series.title} - E${ep.number}`);
        guid = video.guid;
        await db(() =>
          prisma.episode.update({ where: { id: ep.id }, data: { bunnyGuid: guid, bunnyStatus: "queued", bunnyError: null } }),
        );
        await uploadVideoFile(guid, file);
        await db(() => prisma.episode.update({ where: { id: ep.id }, data: { bunnyStatus: "processing" } }));
        s.uploaded++;
        s.bytes += bytes;
        log(`  ↑ ${label} → ${guid} (${src.embedUrl.split("/")[2]}, ${(bytes / 1e6).toFixed(0)} MB, dl ${dlSec.toFixed(0)}s @ ${(bytes / 1e6 / Math.max(dlSec, 1)).toFixed(1)} MB/s)`);
        ok = true;
        break;
      } catch (e) {
        lastErr = (e as Error).message;
        if (guid) {
          await deleteVideo(guid).catch(() => {});
          await db(() => prisma.episode.update({ where: { id: ep.id }, data: { bunnyGuid: null } })).catch(() => {});
        }
        if (/source dead/.test(lastErr)) {
          await db(() =>
            prisma.videoSource.update({ where: { id: src.id }, data: { status: "DEAD", lastCheckedAt: new Date() } }),
          ).catch(() => {});
        }
        log(`  · ${label} via ${src.embedUrl.split("/")[2]}: ${lastErr}`);
      } finally {
        await rm(file, { force: true }).catch(() => {});
      }
    }
    if (ok) {
      consecutiveFails = 0;
    } else {
      consecutiveFails++;
      s.errors.push(`${label}: ${lastErr}`);
      await db(() =>
        prisma.episode.update({ where: { id: ep.id }, data: { bunnyStatus: "failed", bunnyError: `upload-host: ${lastErr}`.slice(0, 200) } }),
      ).catch(() => {});
    }
  }

  const workers = Array.from({ length: Math.max(1, opts.concurrency ?? 5) }, async () => {
    while (true) {
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) return;
      // a download+upload of a big file can take ~20 min: don't start one we can't finish
      if (Date.now() > deadline - 25 * 60_000) return;
      const ep = episodes[next++];
      if (!ep) return;
      s.seen++;
      await one(ep);
      if (s.uploaded && s.uploaded % 10 === 0) await pollHosting({ limit: 200, log }).catch(() => {});
      await sleep(2_000);
    }
  });
  await Promise.all(workers);
  if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) log(`upload-host: ${consecutiveFails} failures in a row — stopping; the next run resumes.`);

  await pollHosting({ limit: 400, log }).catch(() => {});
  await rm(tmp, { recursive: true, force: true }).catch(() => {});
  s.tookMs = Date.now() - started;
  if (run) {
    await db(() =>
      prisma.hostRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: s.errors.length === 0, episodesSeen: s.seen, queued: s.uploaded, errors: s.errors.slice(0, 50) },
      }),
    ).catch(() => {});
  }
  return s;
}
