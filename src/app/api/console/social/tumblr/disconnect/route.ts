import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.socialToken.deleteMany({ where: { platform: "tumblr" } });
  return NextResponse.json({ ok: true });
}
