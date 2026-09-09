import { spawn } from "node:child_process";
import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { normalizeTitle } from "@/lib/ingest";
import {
  bunnyEnabled,
  createVideo,
  uploadVideoFile,
  deleteVideo,
} from "@/lib/hosting/bunny";
import { nyaaSearch, type NyaaResult } from "./nyaa";
import { parseRelease, episodeOfFile } from "./parse";

const VIDEO_RE = /\.(mkv|mp4|avi|wmv|ts|m4v|webm)$/i;
const SAMPLE_RE = /(^|[\s._-])(sample|preview|trailer|cm|pv|op|ed|ncop|nced|menu)([\s._-]|$)/i;

export interface TorrentOptions {
  seriesSlug?: string;
  wanted?: boolean;
  limit?: number;
  dryRun?: boolean;
  minSeeders?: number;
  maxSizeGb?: number;
  downloadDir: string;
  aria2Timeout?: number; // seconds for one torrent
  log?: (m: string) => void;
}

export interface TorrentSummary {
  seriesSeen: number;
  seriesGrabbed: number;
  episodesAdded: number;
  bytesDown: number;
  errors: string[];
  tookMs: number;
}

type SeriesRow = {
  id: string;
  slug: string;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  altTitles: string[];
  year: number | null;
  isCensored: boolean;
  contentWarnings: string[];
  episodes: { number: number; part: number; bunnyStatus: string | null }[];
};

const tok = (s: string) => new Set(s.split(" ").filter((t) => t.length > 1));
function jaccard(a: string, b: string): number {
  const A = tok(a);
  const B = tok(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
}

function titleMatch(s: SeriesRow, guess: string): number {
  const g = normalizeTitle(guess);
  return Math.max(
    ...[s.title, s.titleRomaji, s.titleEnglish, ...s.altTitles]
      .filter(Boolean)
      .map((t) => jaccard(g, normalizeTitle(t as string))),
    0,
  );
}

function score(r: NyaaResult, s: SeriesRow, maxBytes: number): number {
  if (r.sizeBytes > maxBytes || r.seeders <= 0) return 0;
  const p = parseRelease(r.title);
  const tm = titleMatch(s, p.seriesGuess || r.title);
  if (tm < 0.5) return 0;

  let pts = tm * 40;
  pts += Math.min(r.seeders, 40) * 0.6;
  pts += { 2160: 14, 1080: 20, 720: 12, 480: 4, 0: 0 }[p.quality] ?? 0;
  if (p.uncensored === true && !s.isCensored) pts += 14;
  if (p.uncensored === false && !s.isCensored) pts -= 8;
  if (p.isBatch || p.episodes.length > 1) pts += 10;
  return pts;
}

function sh(cmd: string, args: string[], timeoutSec: number, log: (m: string) => void) {
  return new Promise<number>((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const kill = setTimeout(() => p.kill("SIGKILL"), timeoutSec * 1000);
    p.stdout.on("data", (d) => {
      const line = String(d).trim();
      if (line && /\bETA\b|Download complete|error/i.test(line)) log(`    ${line.slice(0, 160)}`);
    });
    p.stderr.on("data", (d) => log(`    ! ${String(d).trim().slice(0, 160)}`));
    p.on("close", (code) => {
      clearTimeout(kill);
      resolve(code ?? -1);
    });
    p.on("error", () => {
      clearTimeout(kill);
      resolve(-1);
    });
  });
}

function walkVideos(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(d, e);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else if (VIDEO_RE.test(e) && !SAMPLE_RE.test(e) && st.size > 20 * 1024 * 1024)
        out.push(full);
    }
  }
  return out;
}

const NOT_READY: Prisma.EpisodeWhereInput = {
  OR: [{ bunnyStatus: null }, { bunnyStatus: { not: "ready" } }],
};

const SERIES_SELECT = {
  id: true,
  slug: true,
  title: true,
  titleRomaji: true,
  titleEnglish: true,
  altTitles: true,
  year: true,
  isCensored: true,
  contentWarnings: true,
  episodes: { select: { number: true, part: true, bunnyStatus: true } },
} satisfies Prisma.SeriesSelect;

async function targets(opts: TorrentOptions): Promise<SeriesRow[]> {
  if (opts.seriesSlug) {
    const s = await db(() =>
      prisma.series.findUnique({
        where: { slug: opts.seriesSlug },
        select: SERIES_SELECT,
      }),
    );
    return s ? [s] : [];
  }

  return db(() =>
    prisma.series.findMany({
      where: {
        publish: { not: "REJECTED" },
        contentWarnings: { isEmpty: true },
        episodes: {
          some: { AND: [NOT_READY, { sources: { none: { status: "ACTIVE" } } }] },
        },
      },
      orderBy: [{ bayesianRating: "desc" }, { viewCount: "desc" }, { year: "desc" }],
      take: opts.limit ?? 5,
      select: SERIES_SELECT,
    }),
  );
}

export async function runTorrentGrab(
  opts: TorrentOptions,
): Promise<TorrentSummary> {
  const log = opts.log ?? (() => {});
  if (!bunnyEnabled()) throw new Error("Bunny env not set");
  const started = Date.now();
  const s: TorrentSummary = {
    seriesSeen: 0,
    seriesGrabbed: 0,
    episodesAdded: 0,
    bytesDown: 0,
    errors: [],
    tookMs: 0,
  };
  const minSeeders = opts.minSeeders ?? 2;
  const maxBytes = (opts.maxSizeGb ?? 8) * 1024 ** 3;
  const aria2Timeout = opts.aria2Timeout ?? 45 * 60;

  const run = opts.dryRun
    ? null
    : await db(() => prisma.torrentRun.create({ data: {}, select: { id: true } })).catch(
        () => null,
      );

  const list = await targets(opts);
  log(`torrent: ${list.length} series to consider`);

  for (const series of list) {
    s.seriesSeen++;
    const need = new Set(
      series.episodes
        .filter((e) => e.part === 1 && e.bunnyStatus !== "ready")
        .map((e) => e.number),
    );
    const label = `${series.title}${series.year ? ` (${series.year})` : ""}`;

    // search nyaa with each title variant, dedupe by infoHash
    const seen = new Set<string>();
    const results: NyaaResult[] = [];
    for (const q of [series.titleRomaji, series.titleEnglish, series.title, ...series.altTitles]
      .filter(Boolean)
      .slice(0, 4)) {
      for (const r of await nyaaSearch(q as string)) {
        if (!seen.has(r.infoHash)) {
          seen.add(r.infoHash);
          results.push(r);
        }
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    const ranked = results
      .map((r) => ({ r, sc: score(r, series, maxBytes) }))
      .filter((x) => x.sc > 25 && x.r.seeders >= minSeeders)
      .sort((a, b) => b.sc - a.sc);

    if (!ranked.length) {
      log(`  ✗ ${label}: no usable torrent`);
      continue;
    }

    const pick = ranked[0];
    log(
      `  → ${label}: "${pick.r.title.slice(0, 70)}" ${pick.r.seeders}S ${(
        pick.r.sizeBytes /
        1024 ** 3
      ).toFixed(2)}G score ${pick.sc.toFixed(0)}`,
    );
    if (opts.dryRun) continue;

    const dir = join(opts.downloadDir, series.slug);
    rmSync(dir, { recursive: true, force: true });

    const code = await sh(
      "aria2c",
      [
        `--dir=${dir}`,
        "--seed-time=0",
        "--bt-stop-timeout=300",
        "--bt-max-peers=120",
        "--follow-torrent=mem",
        "--bt-save-metadata=false",
        "--console-log-level=warn",
        "--summary-interval=30",
        "--file-allocation=none",
        "--max-overall-download-limit=0",
        pick.r.magnet,
      ],
      aria2Timeout,
      log,
    );

    const files = walkVideos(dir);
    if (!files.length) {
      s.errors.push(`${label}: download failed (aria2 ${code}, no video files)`);
      rmSync(dir, { recursive: true, force: true });
      continue;
    }

    // map files → episode numbers
    const single = files.length === 1;
    let added = 0;
    for (const f of files.sort()) {
      const base = f.split(/[\\/]/).pop()!;
      let epNo = episodeOfFile(base);
      if (epNo == null && single) epNo = [...need][0] ?? 1;
      if (epNo == null) {
        log(`    ? can't place ${base}`);
        continue;
      }
      s.bytesDown += statSync(f).size;

      const ep = await db(() =>
        prisma.episode.upsert({
          where: { seriesId_number_part: { seriesId: series.id, number: epNo!, part: 1 } },
          create: { seriesId: series.id, number: epNo!, part: 1, publish: "DRAFT" },
          update: {},
          select: { id: true, bunnyStatus: true },
        }),
      );
      if (ep.bunnyStatus === "ready") {
        log(`    · EP ${epNo} already hosted — skip`);
        continue;
      }

      let vguid: string | null = null;
      try {
        const video = await createVideo(`${series.title} - E${epNo} (torrent)`);
        vguid = video.guid;
        await uploadVideoFile(video.guid, f);
        await db(() =>
          prisma.episode.update({
            where: { id: ep.id },
            data: {
              bunnyGuid: video.guid,
              bunnyStatus: "processing",
              bunnyError: null,
              needsReview: true,
            },
          }),
        );
        await db(() =>
          prisma.videoSource
            .upsert({
              where: {
                episodeId_host_embedUrl: {
                  episodeId: ep.id,
                  host: "OTHER",
                  embedUrl: `torrent:${pick.r.infoHash}`,
                },
              },
              create: {
                episodeId: ep.id,
                host: "OTHER",
                hostName: "torrent",
                embedUrl: `torrent:${pick.r.infoHash}`,
                sourceSite: "nyaa",
                status: "PENDING",
                direct: false,
              },
              update: {},
            })
            .catch(() => {}),
        );
        added++;
        log(`    ↑ EP ${epNo} → ${video.guid}`);
      } catch (e) {
        s.errors.push(`${label} EP ${epNo}: ${(e as Error).message}`);
        if (vguid) await deleteVideo(vguid).catch(() => {});
      }
    }

    rmSync(dir, { recursive: true, force: true });
    if (added) {
      s.seriesGrabbed++;
      s.episodesAdded += added;
    }
  }

  s.tookMs = Date.now() - started;
  if (run) {
    await db(() =>
      prisma.torrentRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          ok: s.errors.length === 0,
          seriesSeen: s.seriesSeen,
          seriesGrabbed: s.seriesGrabbed,
          episodesAdded: s.episodesAdded,
          bytesDown: BigInt(Math.round(s.bytesDown)),
          errors: s.errors.slice(0, 50),
        },
      }),
    ).catch(() => {});
  }
  return s;
}
