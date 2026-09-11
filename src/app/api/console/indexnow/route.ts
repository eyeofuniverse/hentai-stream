import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { pingIndexNowBulk } from "@/lib/indexnow";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** One-off "submit the whole catalogue" job — same URL set sitemap.xml
 *  builds (published series + their published episodes, tags/studios with
 *  content), batched to IndexNow. New content doesn't need this: every
 *  auto-publish path already pings IndexNow itself the moment it goes live
 *  (see publishIfLive in lib/verify.ts). This is for backfilling everything
 *  that was already published before that existed, or after a big import. */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [series, tags, studios] = await db(() =>
    Promise.all([
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        select: {
          slug: true,
          episodes: { where: { publish: "PUBLISHED" }, select: { number: true } },
        },
      }),
      prisma.tag.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true } }),
      prisma.studio.findMany({ where: { seriesCount: { gt: 0 } }, select: { slug: true } }),
    ]),
  );

  const episodeCount = series.reduce((n, s) => n + s.episodes.length, 0);

  const urls = [
    `${SITE}/`,
    `${SITE}/browse`,
    `${SITE}/tags`,
    `${SITE}/calendar`,
    ...series.flatMap((s) => [
      `${SITE}/hentai/${s.slug}`,
      ...s.episodes.map((e) => `${SITE}/hentai/${s.slug}/${e.number}`),
    ]),
    ...tags.map((t) => `${SITE}/tag/${t.slug}`),
    ...studios.map((s) => `${SITE}/studio/${s.slug}`),
  ];

  const { submitted, failed } = await pingIndexNowBulk(urls);

  return NextResponse.json({
    ok: true,
    seriesCount: series.length,
    episodeCount,
    tagCount: tags.length,
    studioCount: studios.length,
    totalUrls: new Set(urls).size,
    submitted,
    failed,
  });
}
