import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    await requireRole("ADMIN", "MODERATOR");
    return true;
  } catch {
    return false;
  }
}

function clean(body: Record<string, unknown>) {
  return {
    slot: String(body.slot ?? ""),
    name: String(body.name ?? "").slice(0, 200),
    type: ["network", "affiliate", "sponsored"].includes(String(body.type))
      ? String(body.type)
      : "network",
    deviceType: ["all", "mobile", "desktop"].includes(String(body.deviceType))
      ? String(body.deviceType)
      : "all",
    networkCode: body.networkCode ? String(body.networkCode).slice(0, 20000) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 2000) : null,
    linkUrl: body.linkUrl ? String(body.linkUrl).slice(0, 2000) : null,
    altText: body.altText ? String(body.altText).slice(0, 300) : null,
    adTitle: body.adTitle ? String(body.adTitle).slice(0, 200) : null,
    adDescription: body.adDescription
      ? String(body.adDescription).slice(0, 400)
      : null,
    isActive: body.isActive !== false,
    priority: Number(body.priority) || 0,
  };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ad = await prisma.ad
    .update({ where: { id }, data: clean(body) })
    .catch(() => null);
  if (!ad) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ad);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.ad.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
