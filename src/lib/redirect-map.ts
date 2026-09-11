import { prisma, db } from "@/lib/db";

/**
 * Looks up a permanent redirect for a path that just 404'd (e.g. a series/
 * episode slug that got merged into another one during dedup cleanup).
 * Read-only, best-effort — never throws, so a redirect-map hiccup degrades
 * to a normal 404 instead of breaking the page.
 */
export async function findRedirect(fromPath: string): Promise<string | null> {
  try {
    const hit = await db(() =>
      prisma.redirectMap.findUnique({ where: { fromPath }, select: { toPath: true } }),
    );
    return hit?.toPath ?? null;
  } catch {
    return null;
  }
}
