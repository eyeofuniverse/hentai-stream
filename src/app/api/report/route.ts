import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  targetType: z.enum(["series", "episode", "source"]),
  targetId: z.string(),
  reason: z.enum([
    "BROKEN_LINK",
    "WRONG_CONTENT",
    "UNDERAGE",
    "COPYRIGHT",
    "SPAM",
    "OTHER",
  ]),
  details: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const session = await getSessionUser().catch(() => null);
  const d = parsed.data;

  await prisma.report.create({
    data: {
      targetType: d.targetType,
      targetId: d.targetId,
      reason: d.reason,
      details: d.details,
      reporterId: session?.id ?? null,
    },
  });

  // Underage reports pull the content immediately, pending review.
  if (d.reason === "UNDERAGE") {
    if (d.targetType === "series")
      await prisma.series.update({ where: { id: d.targetId }, data: { publish: "HIDDEN" } }).catch(() => {});
    if (d.targetType === "episode")
      await prisma.episode.update({ where: { id: d.targetId }, data: { publish: "HIDDEN" } }).catch(() => {});
  }

  // Broken-link reports bump a counter; auto-flag at a threshold.
  if (d.reason === "BROKEN_LINK" && d.targetType === "episode") {
    await prisma.videoSource
      .updateMany({
        where: { episodeId: d.targetId, status: "ACTIVE" },
        data: { brokenReports: { increment: 1 } },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
