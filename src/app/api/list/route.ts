import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireViewer, Unauthorized } from "@/lib/user";
import { rateLimit } from "@/lib/ratelimit";
import type { ListStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES = ["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "ON_HOLD", "DROPPED"];

export async function POST(req: Request) {
  let me;
  try {
    me = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    throw e;
  }

  if (!rateLimit(`list:${me.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const seriesId = String(body.seriesId ?? "");
  const status = String(body.status ?? "");
  if (!seriesId)
    return NextResponse.json({ error: "seriesId required" }, { status: 400 });

  if (status === "remove") {
    await prisma.listEntry
      .delete({ where: { profileId_seriesId: { profileId: me.id, seriesId } } })
      .catch(() => {});
    return NextResponse.json({ ok: true, status: null });
  }

  if (!STATUSES.includes(status))
    return NextResponse.json({ error: "bad status" }, { status: 400 });

  const exists = await prisma.series
    .findUnique({ where: { id: seriesId }, select: { id: true } })
    .catch(() => null);
  if (!exists)
    return NextResponse.json({ error: "unknown series" }, { status: 404 });

  await prisma.listEntry.upsert({
    where: { profileId_seriesId: { profileId: me.id, seriesId } },
    create: { profileId: me.id, seriesId, status: status as ListStatus },
    update: { status: status as ListStatus },
  });
  return NextResponse.json({ ok: true, status });
}
