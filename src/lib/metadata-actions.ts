"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { getAnime, normalize } from "@/lib/metadata/mal";
import {
  importSeason,
  importSeries,
  recountTaxonomy,
  type ImportStats,
} from "@/lib/metadata/importer";

const SEASONS = ["winter", "spring", "summer", "fall"] as const;

/** Sync the last, current and next season from MAL — the "run now" button. */
export async function runMetadataSync() {
  await requireAdmin("ADMIN");
  const now = new Date();
  const y = now.getFullYear();
  const si = Math.floor(now.getMonth() / 3);
  const targets: { year: number; season: (typeof SEASONS)[number] }[] = [
    { year: si === 0 ? y - 1 : y, season: SEASONS[(si + 3) % 4] },
    { year: y, season: SEASONS[si] },
    { year: si === 3 ? y + 1 : y, season: SEASONS[(si + 1) % 4] },
  ];

  const stats: ImportStats = {
    scanned: 0, created: 0, updated: 0, skipped: 0, flagged: 0, episodeStubs: 0, errors: [],
  };
  const t0 = Date.now();
  for (const target of targets) await importSeason(target.year, target.season, stats);
  await recountTaxonomy().catch(() => {});

  const result = {
    mode: "weekly",
    seasons: targets.length,
    ...stats,
    errors: stats.errors.slice(0, 25),
    tookMs: Date.now() - t0,
    at: new Date().toISOString(),
  };
  await prisma.setting.upsert({
    where: { key: "metadataSync" },
    update: { value: result },
    create: { key: "metadataSync", value: result },
  });
  revalidatePath("/console/metadata");
}

/** Re-pull one series from MAL (button on the series editor). */
export async function repullSeries(seriesId: string) {
  await requireAdmin();
  const s = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { malId: true },
  });
  if (!s?.malId) throw new Error("This series has no MAL id");

  const anime = await getAnime(s.malId);
  const stats: ImportStats = {
    scanned: 0, created: 0, updated: 0, skipped: 0, flagged: 0, episodeStubs: 0, errors: [],
  };
  await importSeries(normalize(anime), stats);
  revalidatePath(`/console/series/${seriesId}`);
}
