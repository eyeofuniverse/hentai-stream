import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { malEnabled, type MalSeason } from "@/lib/metadata/mal";
import { importSeason, recountTaxonomy } from "@/lib/metadata/importer";
import type { ImportStats } from "@/lib/metadata/importer";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const SEASONS: MalSeason[] = ["winter", "spring", "summer", "fall"];

function seasonOf(d: Date): { year: number; season: MalSeason } {
  return { year: d.getFullYear(), season: SEASONS[Math.floor(d.getMonth() / 3)] };
}
function shift(y: number, s: MalSeason, by: number) {
  let i = SEASONS.indexOf(s) + by;
  let year = y;
  while (i < 0) {
    i += 4;
    year--;
  }
  while (i > 3) {
    i -= 4;
    year++;
  }
  return { year, season: SEASONS[i] };
}

/**
 * Pull hentai catalogue metadata from MyAnimeList.
 *   ?mode=weekly              prev + current + next season (default; the cron job)
 *   ?mode=range&from=&to=     season-walk a year range (the one-off backfill)
 *   ?year=&season=            a single season
 *
 * Auth: Authorization: Bearer <CRON_SECRET>   or   ?key=<CRON_SECRET>
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("key");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!malEnabled()) {
    return NextResponse.json({ error: "MAL_CLIENT_ID not set" }, { status: 500 });
  }

  const started = Date.now();

  if (url.searchParams.get("recount") === "only") {
    try {
      await recountTaxonomy();
      return NextResponse.json({ recount: "done", tookMs: Date.now() - started });
    } catch (e) {
      return NextResponse.json(
        { recount: "failed", error: (e as Error).message },
        { status: 500 },
      );
    }
  }

  const mode = url.searchParams.get("mode") ?? "weekly";
  const stats: ImportStats = {
    scanned: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    flagged: 0,
    errors: [],
  };

  const targets: { year: number; season: MalSeason }[] = [];

  if (url.searchParams.get("year") && url.searchParams.get("season")) {
    targets.push({
      year: Number(url.searchParams.get("year")),
      season: url.searchParams.get("season") as MalSeason,
    });
  } else if (mode === "range") {
    const from = Number(url.searchParams.get("from")) || 1985;
    const to = Number(url.searchParams.get("to")) || new Date().getFullYear() + 1;
    for (let y = from; y <= to; y++) {
      for (const s of SEASONS) targets.push({ year: y, season: s });
    }
  } else {
    const now = seasonOf(new Date());
    targets.push(
      shift(now.year, now.season, -1),
      now,
      shift(now.year, now.season, 1),
    );
  }

  for (const t of targets) {
    try {
      await importSeason(t.year, t.season, stats);
    } catch (e) {
      // importSeason already swallows per-title + per-season errors; this is the
      // last-ditch guard so one bad season can't turn the whole response into
      // an HTML 500 page.
      stats.errors.push(`${t.year}/${t.season}: ${(e as Error).message}`);
    }
  }

  // the backfill script passes recount=0 per chunk and calls recount=only once
  if (url.searchParams.get("recount") !== "0") {
    await recountTaxonomy().catch((e) =>
      stats.errors.push(`recount: ${(e as Error).message}`),
    );
  }

  const result = {
    ok: true,
    mode,
    seasons: targets.length,
    ...stats,
    errorCount: stats.errors.length,
    errors: stats.errors.slice(0, 25),
    tookMs: Date.now() - started,
    at: new Date().toISOString(),
  };

  await db(() =>
    prisma.setting.upsert({
      where: { key: "metadataSync" },
      update: { value: result },
      create: { key: "metadataSync", value: result },
    }),
  ).catch(() => {});

  return NextResponse.json(result);
}

/** Never let an unexpected throw become an HTML error page — the backfill
 *  script parses JSON and a `<!DOCTYPE …>` body derails the whole run. */
async function safeHandle(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message ?? "unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return safeHandle(req);
}
export async function POST(req: Request) {
  return safeHandle(req);
}
