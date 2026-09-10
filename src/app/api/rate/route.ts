import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";
import { requireViewer, Unauthorized } from "@/lib/user";

export const dynamic = "force-dynamic";

// bayesian prior: pull small samples toward a neutral mean
const PRIOR_WEIGHT = 8;
const PRIOR_MEAN = 6.5;

export async function POST(req: Request) {
  let me;
  try {
    me = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const seriesId = String(body.seriesId ?? "");
  const value = Math.round(Number(body.value));
  if (!seriesId)
    return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  if (!(value === 0 || (value >= 1 && value <= 10)))
    return NextResponse.json({ error: "value 1–10 (or 0 to clear)" }, { status: 400 });

  await db(() =>
    prisma.$transaction(async (tx) => {
      if (value === 0) {
        await tx.rating
          .delete({ where: { profileId_seriesId: { profileId: me.id, seriesId } } })
          .catch(() => {});
      } else {
        await tx.rating.upsert({
          where: { profileId_seriesId: { profileId: me.id, seriesId } },
          create: { profileId: me.id, seriesId, value },
          update: { value },
        });
      }
      const agg = await tx.rating.aggregate({
        where: { seriesId },
        _avg: { value: true },
        _count: true,
      });
      const count = agg._count;
      const avg = agg._avg.value ?? 0;
      const bayesian =
        (PRIOR_WEIGHT * PRIOR_MEAN + avg * count) / (PRIOR_WEIGHT + count) || 0;
      await tx.series.update({
        where: { id: seriesId },
        data: {
          ratingAvg: avg,
          ratingCount: count,
          bayesianRating: Number(bayesian.toFixed(4)),
        },
      });
    }),
  );

  return NextResponse.json({ ok: true, value: value || null });
}
