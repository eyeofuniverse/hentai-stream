import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { resolveVast } from "@/lib/vast";

export const dynamic = "force-dynamic";

type VastSetting = { tags: string[]; capMinutes: number; skipAfterSec: number };

const DEFAULTS: VastSetting = { tags: [], capMinutes: 30, skipAfterSec: 0 };

export async function GET() {
  const row = await db(() =>
    prisma.setting.findUnique({ where: { key: "vastAds" } }),
  ).catch(() => null);
  const cfg = { ...DEFAULTS, ...((row?.value as Partial<VastSetting>) ?? {}) };

  if (!cfg.tags.length) {
    return NextResponse.json(
      { ad: null, capMinutes: cfg.capMinutes },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const resolved = await resolveVast(cfg.tags).catch(() => null);
  if (!resolved) {
    return NextResponse.json(
      { ad: null, capMinutes: cfg.capMinutes },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // admin override takes precedence over whatever the ad's own VAST says;
  // 0/unset means "trust the ad", with a sane floor if the ad specifies none
  const skipOffsetSec =
    cfg.skipAfterSec > 0 ? cfg.skipAfterSec : (resolved.skipOffsetSec ?? 5);

  return NextResponse.json(
    { ad: { ...resolved, skipOffsetSec }, capMinutes: cfg.capMinutes },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
