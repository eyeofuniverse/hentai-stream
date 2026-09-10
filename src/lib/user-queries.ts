import "server-only";
import { prisma } from "@/lib/db";

const cardSelect = {
  slug: true,
  title: true,
  coverUrl: true,
  year: true,
  type: true,
  status: true,
  isCensored: true,
  externalScore: true,
  _count: { select: { episodes: { where: { publish: "PUBLISHED" as const } } } },
};

/** This viewer's watchlist + rating for one series (for the series-page controls). */
export async function mySeriesState(profileId: string, seriesId: string) {
  const [list, rating] = await Promise.all([
    prisma.listEntry
      .findUnique({
        where: { profileId_seriesId: { profileId, seriesId } },
        select: { status: true },
      })
      .catch(() => null),
    prisma.rating
      .findUnique({
        where: { profileId_seriesId: { profileId, seriesId } },
        select: { value: true },
      })
      .catch(() => null),
  ]);
  return { listStatus: list?.status ?? null, myRating: rating?.value ?? null };
}

/** Full watchlist grouped by status. */
export async function myWatchlist(profileId: string) {
  const rows = await prisma.listEntry
    .findMany({
      where: { profileId, series: { publish: "PUBLISHED" } },
      orderBy: { updatedAt: "desc" },
      select: { status: true, updatedAt: true, series: { select: cardSelect } },
    })
    .catch(() => []);
  return rows;
}

/** Most-recent unfinished episodes — the "Continue watching" rail. */
export async function continueWatching(profileId: string, limit = 12) {
  const rows = await prisma.watchProgress
    .findMany({
      where: {
        profileId,
        completed: false,
        episode: { publish: "PUBLISHED", series: { publish: "PUBLISHED" } },
      },
      orderBy: { lastWatchedAt: "desc" },
      take: limit,
      select: {
        lastWatchedAt: true,
        episode: {
          select: {
            number: true,
            title: true,
            bunnyGuid: true,
            bunnyStatus: true,
            thumbUrl: true,
            series: { select: { slug: true, title: true, coverUrl: true } },
          },
        },
      },
    })
    .catch(() => []);
  return rows;
}

/** Full watch history (completed + in-progress), newest first. */
export async function myHistory(profileId: string, limit = 60) {
  return prisma.watchProgress
    .findMany({
      where: {
        profileId,
        episode: { publish: "PUBLISHED", series: { publish: "PUBLISHED" } },
      },
      orderBy: { lastWatchedAt: "desc" },
      take: limit,
      select: {
        completed: true,
        lastWatchedAt: true,
        episode: {
          select: {
            number: true,
            title: true,
            bunnyGuid: true,
            bunnyStatus: true,
            thumbUrl: true,
            series: { select: { slug: true, title: true, coverUrl: true } },
          },
        },
      },
    })
    .catch(() => []);
}
