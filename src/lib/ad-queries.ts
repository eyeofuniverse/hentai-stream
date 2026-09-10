import { prisma, db } from "@/lib/db";
import { AD_SLOTS } from "@/lib/ads";

export type ActiveAd = {
  type: string;
  deviceType: string;
  networkCode: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  altText: string | null;
  adTitle: string | null;
  adDescription: string | null;
};

/**
 * Pick the ad to serve for a slot: highest priority among ads matching the
 * viewer's device (a device-specific ad always beats an "all" fallback), ties
 * broken by random rotation. Returns null when the slot is empty.
 */
export async function getActiveAdForSlot(
  slot: string,
  device = "all",
): Promise<ActiveAd | null> {
  // honour the registry: a desktop-only slot (rail / sidebar) never serves on
  // mobile, and vice-versa — even if an "all" ad exists
  const def = AD_SLOTS[slot];
  if (def) {
    if (device === "mobile" && !def.mobile) return null;
    if (device === "desktop" && !def.desktop) return null;
  }
  try {
    const ads = await db(() =>
      prisma.ad.findMany({
        where: { slot, isActive: true, deviceType: { in: [device, "all"] } },
        orderBy: { priority: "desc" },
        take: 12,
        select: {
          type: true,
          deviceType: true,
          networkCode: true,
          imageUrl: true,
          linkUrl: true,
          altText: true,
          adTitle: true,
          adDescription: true,
          priority: true,
        },
      }),
    );
    if (!ads.length) return null;

    const specific =
      device !== "all" ? ads.filter((a) => a.deviceType === device) : [];
    const pool = specific.length
      ? specific
      : ads.filter((a) => a.deviceType === "all");
    if (!pool.length) return null;

    const top = pool[0].priority;
    const topPool = pool.filter((a) => a.priority === top);
    const chosen = topPool[Math.floor(Math.random() * topPool.length)];
    const { priority: _p, ...rest } = chosen;
    void _p;
    return rest;
  } catch {
    return null;
  }
}

export async function listAds() {
  try {
    return await db(() =>
      prisma.ad.findMany({ orderBy: [{ slot: "asc" }, { priority: "desc" }] }),
    );
  } catch {
    return [];
  }
}
