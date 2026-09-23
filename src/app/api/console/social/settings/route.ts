import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getSocialSetting, type Platform } from "@/lib/social/post";
import { isBlueskyConfigured } from "@/lib/social/bluesky";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await getSocialSetting();

  return NextResponse.json({
    ...setting,
    bluesky: { configured: isBlueskyConfigured() },
  });
}

const PLATFORMS: Platform[] = ["bluesky"];

export async function PUT(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const autoEnabled = body.autoEnabled === true;
  const autoPlatforms = Array.isArray(body.autoPlatforms)
    ? (body.autoPlatforms.filter((p: unknown): p is Platform => PLATFORMS.includes(p as Platform)) as Platform[])
    : [];
  const defaultTags = Array.isArray(body.defaultTags)
    ? body.defaultTags
        .filter((t: unknown): t is string => typeof t === "string")
        .map((t: string) => t.trim())
        .filter(Boolean)
        .slice(0, 15)
    : [];

  await prisma.setting.upsert({
    where: { key: "social" },
    update: { value: { autoEnabled, autoPlatforms, defaultTags } },
    create: { key: "social", value: { autoEnabled, autoPlatforms, defaultTags } },
  });

  return NextResponse.json({ ok: true, autoEnabled, autoPlatforms, defaultTags });
}
