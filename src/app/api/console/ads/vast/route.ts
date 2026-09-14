import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

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
  const row = await prisma.setting.findUnique({ where: { key: "vastAds" } }).catch(() => null);
  const v = (row?.value as { tags?: string[]; capMinutes?: number; skipAfterSec?: number }) ?? {};
  return NextResponse.json({
    tags: Array.isArray(v.tags) ? v.tags : [],
    capMinutes: typeof v.capMinutes === "number" ? v.capMinutes : 30,
    skipAfterSec: typeof v.skipAfterSec === "number" ? v.skipAfterSec : 0,
  });
}

export async function PUT(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string" && /^https?:\/\//i.test(t)).slice(0, 5)
    : [];
  const capMinutes = Math.min(1440, Math.max(0, Number(body.capMinutes) || 0));
  const skipAfterSec = Math.min(120, Math.max(0, Number(body.skipAfterSec) || 0));

  await prisma.setting.upsert({
    where: { key: "vastAds" },
    update: { value: { tags, capMinutes, skipAfterSec } },
    create: { key: "vastAds", value: { tags, capMinutes, skipAfterSec } },
  });

  return NextResponse.json({ ok: true, tags, capMinutes, skipAfterSec });
}
