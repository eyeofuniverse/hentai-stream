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

export async function GET() {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ads = await prisma.ad.findMany({
    orderBy: [{ slot: "asc" }, { priority: "desc" }],
  });
  return NextResponse.json(ads);
}

export async function POST(req: Request) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = clean(body);
  if (!data.slot || !data.name)
    return NextResponse.json({ error: "slot and name required" }, { status: 400 });
  const ad = await prisma.ad.create({ data });
  return NextResponse.json(ad, { status: 201 });
}
