import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { AD_SLOTS } from "@/lib/ads";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

type VariantIn = {
  type?: string;
  networkCode?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  altText?: string | null;
  adTitle?: string | null;
  adDescription?: string | null;
  priority?: number;
  active?: boolean;
};

/** Is this variant actually filled in? */
function hasContent(v: VariantIn | null | undefined): boolean {
  if (!v) return false;
  const t = v.type === "affiliate" ? "affiliate" : "network";
  return t === "affiliate"
    ? !!(v.imageUrl && v.imageUrl.trim() && v.linkUrl && v.linkUrl.trim())
    : !!(v.networkCode && v.networkCode.trim());
}

function row(slot: string, deviceType: string, v: VariantIn, index: number) {
  const type = v.type === "affiliate" ? "affiliate" : "network";
  const label = AD_SLOTS[slot]?.label ?? slot;
  return {
    slot,
    deviceType,
    name: `${label} — ${deviceType}${index > 0 ? ` #${index + 1}` : ""}`,
    type,
    networkCode: type === "network" ? String(v.networkCode ?? "").slice(0, 20000) : null,
    imageUrl: type === "affiliate" ? String(v.imageUrl ?? "").slice(0, 2000) : null,
    linkUrl: type === "affiliate" ? String(v.linkUrl ?? "").slice(0, 2000) : null,
    altText: v.altText ? String(v.altText).slice(0, 300) : null,
    adTitle: v.adTitle ? String(v.adTitle).slice(0, 200) : null,
    adDescription: v.adDescription ? String(v.adDescription).slice(0, 400) : null,
    isActive: v.active !== false,
    priority: Number.isFinite(v.priority) ? Math.trunc(v.priority as number) : 0,
  };
}

/** GET  /api/console/ads/slot?slot=<key>  → { desktop, mobile, all } rotation pools */
export async function GET(req: Request) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slot = new URL(req.url).searchParams.get("slot") ?? "";
  if (!slot || !AD_SLOTS[slot])
    return NextResponse.json({ error: "Unknown slot" }, { status: 400 });
  const rows = await prisma.ad.findMany({ where: { slot }, orderBy: { priority: "desc" } });
  const by = (d: string) => rows.filter((r) => r.deviceType === d);
  return NextResponse.json({
    slot,
    desktop: by("desktop"),
    mobile: by("mobile"),
    all: by("all"),
  });
}

/**
 * PUT  /api/console/ads/slot
 * body: { slot, desktop?: Variant[]|null, mobile?: Variant[]|null, all?: Variant[]|null, versions }
 *
 * Replaces this slot's rows entirely: a band that's provided gets every
 * filled variant in its array written as its own row (the rotation pool —
 * same priority = random rotation, see getActiveAdForSlot); an omitted or
 * empty band is cleared. Editing "desktop" therefore NEVER touches mobile.
 */
export async function PUT(req: Request) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slot = String(body.slot ?? "");
  const def = AD_SLOTS[slot];
  if (!def) return NextResponse.json({ error: "Unknown slot" }, { status: 400 });

  // optimistic concurrency: the client echoes back each band's row-id set
  // (from its last GET). If a band's current id set differs, another admin
  // saved in between — reject rather than silently clobbering their change.
  const current = await prisma.ad.findMany({
    where: { slot },
    select: { id: true, deviceType: true },
  });
  const currentIdsByDevice: Record<string, string[]> = { desktop: [], mobile: [], all: [] };
  for (const r of current) currentIdsByDevice[r.deviceType]?.push(r.id);
  for (const k of Object.keys(currentIdsByDevice)) currentIdsByDevice[k].sort();

  const versions = (body.versions ?? {}) as Record<string, unknown>;
  for (const device of ["desktop", "mobile", "all"] as const) {
    const seen = Array.isArray(versions[device])
      ? [...(versions[device] as string[])].sort()
      : null;
    if (seen === null) continue; // client never loaded this band — nothing to conflict with
    if (JSON.stringify(seen) !== JSON.stringify(currentIdsByDevice[device])) {
      return NextResponse.json(
        { error: "conflict", message: "This slot was changed by someone else. Reload and try again." },
        { status: 409 },
      );
    }
  }

  const wanted: { device: string; v: VariantIn; index: number }[] = [];
  for (const device of ["desktop", "mobile", "all"] as const) {
    // respect the registry: skip a device band the slot doesn't have
    if (device === "desktop" && !def.desktop) continue;
    if (device === "mobile" && !def.mobile) continue;
    const arr = Array.isArray(body[device]) ? (body[device] as VariantIn[]) : [];
    let i = 0;
    for (const v of arr) {
      if (hasContent(v)) wanted.push({ device, v, index: i++ });
    }
  }

  await prisma.$transaction([
    prisma.ad.deleteMany({ where: { slot } }),
    ...wanted.map(({ device, v, index }) =>
      prisma.ad.create({ data: row(slot, device, v, index) }),
    ),
  ]);

  return NextResponse.json({ ok: true, count: wanted.length });
}
