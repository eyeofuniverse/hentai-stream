import "server-only";
import { prisma } from "@/lib/db";

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  coverUrl: true,
  year: true,
  type: true,
  status: true,
  isCensored: true,
  externalScore: true,
  ratingAvg: true,
  ratingCount: true,
  _count: { select: { episodes: { where: { publish: "PUBLISHED" as const } } } },
};

/** Headline counts for the account page. */
export async function myStats(profileId: string) {
  const [watchlist, watched, ratings] = await Promise.all([
    prisma.listEntry.count({ where: { profileId } }).catch(() => 0),
    prisma.watchProgress
      .count({ where: { profileId, completed: true } })
      .catch(() => 0),
    prisma.rating.count({ where: { profileId } }).catch(() => 0),
  ]);
  return { watchlist, watched, ratings };
}

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

export type ContinueItem = {
  slug: string;
  seriesTitle: string;
  coverUrl: string | null;
  number: number; // the episode to resume / start next
  title: string | null;
  bunnyGuid: string | null;
  bunnyStatus: string | null;
  thumbUrl: string | null;
  resume: boolean; // true = pick up where you left off; false = next unwatched
  lastWatchedAt: Date;
};

/**
 * "Continue watching": one entry per series. Takes the most recently touched
 * episode; if you finished it and a later episode exists, points at the next
 * one instead of a dead end.
 */
export async function continueWatching(
  profileId: string,
  limit = 12,
): Promise<ContinueItem[]> {
  const rows = await prisma.watchProgress
    .findMany({
      where: {
        profileId,
        episode: { publish: "PUBLISHED", series: { publish: "PUBLISHED" } },
      },
      orderBy: { lastWatchedAt: "desc" },
      take: 120,
      select: {
        completed: true,
        lastWatchedAt: true,
        episode: {
          select: {
            id: true,
            number: true,
            title: true,
            bunnyGuid: true,
            bunnyStatus: true,
            thumbUrl: true,
            seriesId: true,
            series: {
              select: {
                slug: true,
                title: true,
                coverUrl: true,
                episodes: {
                  where: { publish: "PUBLISHED" },
                  orderBy: { number: "asc" },
                  select: {
                    number: true,
                    title: true,
                    bunnyGuid: true,
                    bunnyStatus: true,
                    thumbUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    .catch(() => []);

  const seen = new Set<string>();
  const out: ContinueItem[] = [];
  for (const r of rows) {
    const e = r.episode;
    if (seen.has(e.seriesId)) continue;
    seen.add(e.seriesId);

    let target = {
      number: e.number,
      title: e.title,
      bunnyGuid: e.bunnyGuid,
      bunnyStatus: e.bunnyStatus,
      thumbUrl: e.thumbUrl,
    };
    let resume = !r.completed;
    if (r.completed) {
      const nextEp = e.series.episodes.find((x) => x.number > e.number);
      if (nextEp) target = nextEp;
      else continue; // finished the series — nothing to continue
    }

    out.push({
      slug: e.series.slug,
      seriesTitle: e.series.title,
      coverUrl: e.series.coverUrl,
      ...target,
      resume,
      lastWatchedAt: r.lastWatchedAt,
    });
    if (out.length >= limit) break;
  }
  return out;
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
