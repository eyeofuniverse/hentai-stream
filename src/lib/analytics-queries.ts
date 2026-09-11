import "server-only";
import { prisma, db } from "@/lib/db";

type Agg = {
  seriesCount: number;
  totalViews: number;
  totalFavorites: number;
  totalComments: number;
  ratingSum: number;
  ratingWeight: number;
};
const emptyAgg = (): Agg => ({
  seriesCount: 0,
  totalViews: 0,
  totalFavorites: 0,
  totalComments: 0,
  ratingSum: 0,
  ratingWeight: 0,
});

/** Visible comment count per series, id -> count. Shared by both queries
 *  below so a tab that renders both doesn't run it twice. */
async function seriesCommentCounts(): Promise<Map<string, number>> {
  const rows = await prisma.comment.groupBy({
    by: ["targetId"],
    where: { targetType: "series", status: "VISIBLE" },
    _count: true,
  });
  return new Map(rows.map((r) => [r.targetId, typeof r._count === "number" ? r._count : 0]));
}

export type TagPerformance = {
  id: string;
  name: string;
  slug: string;
  category: string;
  seriesCount: number;
  totalViews: number;
  totalFavorites: number;
  totalComments: number;
  avgRating: number;
};

/** Per-tag performance across every published series — views, favorites,
 *  comments and a rating-count-weighted average rating. Sorted by total
 *  views, the same "what's actually pulling traffic" ordering as the public
 *  tag pages use. */
export async function getTagPerformance(): Promise<TagPerformance[]> {
  const [tags, series, comments] = await db(() =>
    Promise.all([
      prisma.tag.findMany({ select: { id: true, name: true, slug: true, category: true } }),
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        select: {
          id: true,
          viewCount: true,
          favoriteCount: true,
          ratingAvg: true,
          ratingCount: true,
          tags: { select: { id: true } },
        },
      }),
      seriesCommentCounts(),
    ]),
  );

  const stats = new Map<string, Agg>();
  for (const s of series) {
    const commentCount = comments.get(s.id) ?? 0;
    for (const t of s.tags) {
      const a = stats.get(t.id) ?? emptyAgg();
      a.seriesCount++;
      a.totalViews += s.viewCount;
      a.totalFavorites += s.favoriteCount;
      a.totalComments += commentCount;
      if (s.ratingCount > 0) {
        a.ratingSum += s.ratingAvg * s.ratingCount;
        a.ratingWeight += s.ratingCount;
      }
      stats.set(t.id, a);
    }
  }

  return tags
    .map((t) => {
      const a = stats.get(t.id) ?? emptyAgg();
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        seriesCount: a.seriesCount,
        totalViews: a.totalViews,
        totalFavorites: a.totalFavorites,
        totalComments: a.totalComments,
        avgRating: a.ratingWeight > 0 ? a.ratingSum / a.ratingWeight : 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);
}

export type StudioPerformance = {
  id: string;
  name: string;
  slug: string;
  seriesCount: number;
  totalViews: number;
  totalFavorites: number;
  totalComments: number;
  avgRating: number;
};

/** Same shape as getTagPerformance, grouped by studio instead — lusthentai's
 *  closest equivalent to a "category" breakdown (there's no separate
 *  category taxonomy; series carry tags + a studio). */
export async function getStudioPerformance(): Promise<StudioPerformance[]> {
  const [studios, series, comments] = await db(() =>
    Promise.all([
      prisma.studio.findMany({ select: { id: true, name: true, slug: true } }),
      prisma.series.findMany({
        where: { publish: "PUBLISHED", studioId: { not: null } },
        select: {
          id: true,
          studioId: true,
          viewCount: true,
          favoriteCount: true,
          ratingAvg: true,
          ratingCount: true,
        },
      }),
      seriesCommentCounts(),
    ]),
  );

  const stats = new Map<string, Agg>();
  for (const s of series) {
    if (!s.studioId) continue;
    const a = stats.get(s.studioId) ?? emptyAgg();
    a.seriesCount++;
    a.totalViews += s.viewCount;
    a.totalFavorites += s.favoriteCount;
    a.totalComments += comments.get(s.id) ?? 0;
    if (s.ratingCount > 0) {
      a.ratingSum += s.ratingAvg * s.ratingCount;
      a.ratingWeight += s.ratingCount;
    }
    stats.set(s.studioId, a);
  }

  return studios
    .map((st) => {
      const a = stats.get(st.id) ?? emptyAgg();
      return {
        id: st.id,
        name: st.name,
        slug: st.slug,
        seriesCount: a.seriesCount,
        totalViews: a.totalViews,
        totalFavorites: a.totalFavorites,
        totalComments: a.totalComments,
        avgRating: a.ratingWeight > 0 ? a.ratingSum / a.ratingWeight : 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);
}
