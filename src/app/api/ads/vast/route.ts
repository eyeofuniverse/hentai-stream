import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";

export const dynamic = "force-dynamic";

type VastSetting = { tags: string[]; capMinutes: number; skipAfterSec: number };

const DEFAULTS: VastSetting = { tags: [], capMinutes: 30, skipAfterSec: 0 };

/**
 * Config only — the VAST tag itself is resolved in the viewer's browser (see
 * lib/vast-client.ts), never here. Resolving it server-side made ExoClick see
 * a datacenter IP + bot UA instead of the real viewer and dropped the
 * wrapper-level pixels that carry the paid impression/view events.
 */
export async function GET() {
  const row = await db(() =>
    prisma.setting.findUnique({ where: { key: "vastAds" } }),
  ).catch(() => null);
  const cfg = { ...DEFAULTS, ...((row?.value as Partial<VastSetting>) ?? {}) };

  return NextResponse.json(
    {
      tags: (Array.isArray(cfg.tags) ? cfg.tags : []).filter(
        (t): t is string => typeof t === "string" && /^https:\/\//i.test(t),
      ),
      capMinutes: cfg.capMinutes,
      skipAfterSec: cfg.skipAfterSec,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
