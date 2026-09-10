"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

/** Map an unmatched scraped title onto a Series. Its raw title is saved as an
 *  alt-title so the next crawl resolves it automatically. */
export async function mapUnmatched(unmatchedId: string, seriesId: string) {
  await requireAdmin();

  const [u, s] = await Promise.all([
    prisma.unmatchedTitle.findUnique({ where: { id: unmatchedId } }),
    prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true, altTitles: true, slug: true },
    }),
  ]);
  if (!u || !s) throw new Error("Not found");

  const alt = [...new Set([...s.altTitles, u.rawTitle])];
  await prisma.$transaction([
    prisma.series.update({ where: { id: s.id }, data: { altTitles: alt } }),
    prisma.unmatchedTitle.update({
      where: { id: unmatchedId },
      data: { status: "MAPPED", resolvedSeriesId: s.id },
    }),
  ]);

  revalidatePath("/console/unmatched");
  revalidatePath(`/console/series/${s.id}`);
}

export async function setUnmatchedStatus(
  id: string,
  status: "PENDING" | "IGNORED",
) {
  await requireAdmin();
  await prisma.unmatchedTitle.update({ where: { id }, data: { status } });
  revalidatePath("/console/unmatched");
}

/** Moderator confirms an auto-published series looks right — clears it from the
 *  spot-check queue. */
export async function confirmAutoPublish(seriesId: string) {
  await requireAdmin();
  await prisma.series.update({
    where: { id: seriesId },
    data: { reviewedAt: new Date() },
  });
  revalidatePath("/console/review");
  revalidatePath(`/console/series/${seriesId}`);
}

/** Typeahead for the "map to series" picker. */
export async function searchSeriesForPicker(q: string) {
  await requireAdmin();
  const term = q.trim();
  if (term.length < 2) return [];
  const ci = { contains: term, mode: "insensitive" as const };
  return prisma.series.findMany({
    where: {
      OR: [
        { title: ci },
        { titleEnglish: ci },
        { titleRomaji: ci },
        { titleOriginal: ci },
        { altTitles: { hasSome: [term] } },
      ],
    },
    orderBy: { bayesianRating: "desc" },
    take: 10,
    select: { id: true, title: true, year: true, _count: { select: { episodes: true } } },
  });
}
