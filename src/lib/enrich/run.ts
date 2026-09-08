import { prisma, db } from "@/lib/db";
import { Http } from "@/lib/scraper/http";
import { applyEnrichment } from "./apply";
import { anilist } from "./sources/anilist";
import { nhentai } from "./sources/nhentai";
import type { Enricher } from "./types";

const ENRICHERS: Record<string, Enricher> = {
  anilist,
  nhentai,
};

const SKIP_COL: Record<string, "anilistId" | "nhentaiId" | "hanimeSlug" | "anidbId"> = {
  anilist: "anilistId",
  nhentai: "nhentaiId",
  hanime: "hanimeSlug",
  anidb: "anidbId",
};

export interface EnrichOptions {
  source: string;
  limit?: number;
  dryRun?: boolean;
  /** re-run even for series that already have this source's id */
  redo?: boolean;
  minGapMs?: number;
  log?: (msg: string) => void;
}

export interface EnrichSummary {
  source: string;
  seriesSeen: number;
  seriesMatched: number;
  fieldsFilled: number;
  tagsAdded: number;
  charactersAdded: number;
  errors: string[];
  dryRun: boolean;
  tookMs: number;
}

export async function runEnrich(opts: EnrichOptions): Promise<EnrichSummary> {
  const log = opts.log ?? (() => {});
  const enricher = ENRICHERS[opts.source];
  if (!enricher) {
    throw new Error(
      `unknown source "${opts.source}" (have: ${Object.keys(ENRICHERS).join(", ")})`,
    );
  }
  const http = new Http(opts.minGapMs ?? (opts.source === "anilist" ? 1300 : 2500));
  const started = Date.now();

  const s: EnrichSummary = {
    source: opts.source,
    seriesSeen: 0,
    seriesMatched: 0,
    fieldsFilled: 0,
    tagsAdded: 0,
    charactersAdded: 0,
    errors: [],
    dryRun: !!opts.dryRun,
    tookMs: 0,
  };

  const col = SKIP_COL[opts.source];
  const targets = await db(() =>
    prisma.series.findMany({
      where: opts.redo ? {} : col ? { [col]: null } : {},
      orderBy: [{ publish: "asc" }, { bayesianRating: "desc" }],
      take: opts.limit ?? 500,
      select: {
        id: true,
        title: true,
        titleEnglish: true,
        titleRomaji: true,
        titleOriginal: true,
        altTitles: true,
        year: true,
        malId: true,
        anilistId: true,
        nhentaiId: true,
        hanimeSlug: true,
        anidbId: true,
      },
    }),
  );
  log(`${opts.source}: ${targets.length} series to enrich`);

  const run = opts.dryRun
    ? null
    : await db(() =>
        prisma.enrichRun.create({ data: { source: opts.source }, select: { id: true } }),
      ).catch(() => null);

  for (const t of targets) {
    s.seriesSeen++;
    let res;
    try {
      res = await enricher.enrich(http, t);
    } catch (e) {
      s.errors.push(`${t.title}: ${(e as Error).message}`);
      continue;
    }
    if (!res.matched) {
      log(`  ? ${t.title} — no match`);
      continue;
    }
    s.seriesMatched++;

    if (opts.dryRun) {
      log(
        `  ✓ ${t.title} → ${res.externalId ?? "?"} · ` +
          `${res.tags?.length ?? 0} tags, ${res.characters?.length ?? 0} chars` +
          `${res.parody ? `, parody: ${res.parody}` : ""}`,
      );
      continue;
    }

    try {
      const a = await applyEnrichment(t.id, opts.source, res);
      s.fieldsFilled += a.fieldsFilled;
      s.tagsAdded += a.tagsAdded;
      s.charactersAdded += a.charactersAdded;
      log(
        `  ✓ ${t.title} → +${a.fieldsFilled} fields, +${a.tagsAdded} tags, +${a.charactersAdded} chars`,
      );
    } catch (e) {
      s.errors.push(`apply ${t.title}: ${(e as Error).message}`);
    }
  }

  s.tookMs = Date.now() - started;

  if (run) {
    await db(() =>
      prisma.enrichRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          ok: s.errors.length === 0,
          seriesSeen: s.seriesSeen,
          seriesMatched: s.seriesMatched,
          fieldsFilled: s.fieldsFilled,
          tagsAdded: s.tagsAdded,
          charactersAdded: s.charactersAdded,
          errors: s.errors.slice(0, 50),
        },
      }),
    ).catch(() => {});
  }

  return s;
}
