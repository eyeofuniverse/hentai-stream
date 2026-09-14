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
  active?: boolean;
} | null;

/** Is this variant actually filled in? */
function hasContent(v: VariantIn): boolean {
  if (!v) return false;
  const t = v.type === "affiliate" ? "affiliate" : "network";
  return t === "affiliate"
    ? !!(v.imageUrl && v.imageUrl.trim() && v.linkUrl && v.linkUrl.trim())
    : !!(v.networkCode && v.networkCode.trim());
}

function row(slot: string, deviceType: string, v: NonNullable<VariantIn>) {
  const type = v.type === "affiliate" ? "affiliate" : "network";
  const label = AD_SLOTS[slot]?.label ?? slot;
  return {
    slot,
    deviceType,
    name: `${label} — ${deviceType}`,
    type,
    networkCode: type === "network" ? String(v.networkCode ?? "").slice(0, 20000) : null,
    imageUrl: type === "affiliate" ? String(v.imageUrl ?? "").slice(0, 2000) : null,
    linkUrl: type === "affiliate" ? String(v.linkUrl ?? "").slice(0, 2000) : null,
    altText: v.altText ? String(v.altText).slice(0, 300) : null,
    adTitle: v.adTitle ? String(v.adTitle).slice(0, 200) : null,
    adDescription: v.adDescription ? String(v.adDescription).slice(0, 400) : null,
    isActive: v.active !== false,
    priority: 0,
  };
}

/** GET  /api/console/ads/slot?slot=<key>  → { desktop, mobile, all } current rows */
export async function GET(req: Request) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slot = new URL(req.url).searchParams.get("slot") ?? "";
  if (!slot || !AD_SLOTS[slot])
    return NextResponse.json({ error: "Unknown slot" }, { status: 400 });
  const rows = await prisma.ad.findMany({ where: { slot } });
  const by = (d: string) => rows.find((r) => r.deviceType === d) ?? null;
  return NextResponse.json({
    slot,
    desktop: by("desktop"),
    mobile: by("mobile"),
    all: by("all"),
  });
}

/**
 * PUT  /api/console/ads/slot
 * body: { slot, desktop?: Variant|null, mobile?: Variant|null, all?: Variant|null }
 *
 * Replaces this slot's rows entirely: a variant that's provided AND filled in is
 * written for that device band only; anything else is removed. Pasting a code in
 * "desktop" therefore NEVER touches mobile.
 */
export async function PUT(req: Request) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slot = String(body.slot ?? "");
  const def = AD_SLOTS[slot];
  if (!def) return NextResponse.json({ error: "Unknown slot" }, { status: 400 });

  // optimistic concurrency: the client echoes back each band's updatedAt from
  // its last GET. If any band has since changed (another admin's save), that
  // band's stamp won't match the DB anymore — reject the whole PUT rather than
  // silently deleting/overwriting a change this client never saw.
  const current = await prisma.ad.findMany({
    where: { slot },
    select: { deviceType: true, updatedAt: true },
  });
  const currentByDevice: Record<string, string | null> = { desktop: null, mobile: null, all: null };
  for (const r of current) currentByDevice[r.deviceType] = r.updatedAt.toISOString();

  const versions = (body.versions ?? {}) as Record<string, unknown>;
  for (const device of ["desktop", "mobile", "all"] as const) {
    const seen = typeof versions[device] === "string" ? versions[device] : null;
    if (seen !== currentByDevice[device]) {
      return NextResponse.json(
        { error: "conflict", message: "This slot was changed by someone else. Reload and try again." },
        { status: 409 },
      );
    }
  }

  const wanted: { device: string; v: NonNullable<VariantIn> }[] = [];
  for (const device of ["desktop", "mobile", "all"] as const) {
    // respect the registry: skip a device band the slot doesn't have
    if (device === "desktop" && !def.desktop) continue;
    if (device === "mobile" && !def.mobile) continue;
    const v = body[device] as VariantIn;
    if (hasContent(v)) wanted.push({ device, v: v as NonNullable<VariantIn> });
  }

  await prisma.$transaction([
    prisma.ad.deleteMany({ where: { slot } }),
    ...wanted.map(({ device, v }) =>
      prisma.ad.create({ data: row(slot, device, v) }),
    ),
  ]);

  return NextResponse.json({ ok: true, count: wanted.length });
}
