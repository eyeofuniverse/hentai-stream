import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;
export const dynamic = "force-dynamic"; // generated on request, not at build

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let series: {
    slug: string;
    updatedAt: Date;
    episodes: { number: number; updatedAt: Date }[];
  }[] = [];
  let tags: { slug: string }[] = [];
  let studios: { slug: string }[] = [];

  try {
    [series, tags, studios] = await Promise.all([
      prisma.series.findMany({
        where: { publish: "PUBLISHED" },
        select: {
          slug: true,
          updatedAt: true,
          episodes: {
            where: { publish: "PUBLISHED" },
            select: { number: true, updatedAt: true },
          },
        },
      }),
      prisma.tag.findMany({ select: { slug: true } }),
      prisma.studio.findMany({ select: { slug: true } }),
    ]);
  } catch {
    // DB unreachable — still return the static routes
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/browse",
    "/tags",
    "/dmca",
    "/2257",
    "/terms",
    "/privacy",
  ].map((p) => ({ url: `${SITE}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.6 }));

  const seriesRoutes: MetadataRoute.Sitemap = series.flatMap((s) => [
    {
      url: `${SITE}/hentai/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...s.episodes.map((e) => ({
      url: `${SITE}/hentai/${s.slug}/${e.number}`,
      lastModified: e.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]);

  const tagRoutes: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${SITE}/tag/${t.slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const studioRoutes: MetadataRoute.Sitemap = studios.map((s) => ({
    url: `${SITE}/studio/${s.slug}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...seriesRoutes, ...tagRoutes, ...studioRoutes];
}
