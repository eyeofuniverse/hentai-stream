import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  targetType: z.enum(["series", "episode", "source", "comment"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum([
    "BROKEN_LINK",
    "WRONG_CONTENT",
    "UNDERAGE",
    "NON_CONSENSUAL",
    "COPYRIGHT",
    "SPAM",
    "ABUSE",
    "OTHER",
  ]),
  details: z.string().max(2000).optional(),
});

/** Distinct authenticated reporters needed before an UNDERAGE report auto-hides
 *  the content. A moderator's report always hides it immediately. */
const UNDERAGE_AUTOHIDE_THRESHOLD = 2;
/** Distinct reporters before a comment is auto-hidden pending review. */
const COMMENT_AUTOHIDE_THRESHOLD = 3;

export async function POST(req: Request) {
  if (!rateLimit(`report:${clientIp(req)}`, 6, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many reports" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const session = await getSessionUser().catch(() => null);
  if (session?.profile.banned) {
    return NextResponse.json({ ok: true }); // silently drop
  }

  // the target must actually exist — don't let a report create rows / trigger
  // side effects for arbitrary ids
  const exists =
    d.targetType === "series"
      ? await prisma.series.findUnique({ where: { id: d.targetId }, select: { id: true } }).catch(() => null)
      : d.targetType === "episode"
        ? await prisma.episode.findUnique({ where: { id: d.targetId }, select: { id: true } }).catch(() => null)
        : d.targetType === "comment"
          ? await prisma.comment.findUnique({ where: { id: d.targetId }, select: { id: true } }).catch(() => null)
          : await prisma.videoSource.findUnique({ where: { id: d.targetId }, select: { id: true } }).catch(() => null);
  if (!exists) {
    return NextResponse.json({ error: "Unknown target" }, { status: 404 });
  }

  await prisma.report.create({
    data: {
      targetType: d.targetType,
      targetId: d.targetId,
      reason: d.reason,
      details: d.details,
      reporterId: session?.id ?? null,
    },
  });

  // Underage reports: a moderator pulls it now; otherwise it takes a threshold
  // of DISTINCT signed-in reporters. Anonymous reports only queue for review —
  // a single unauthenticated request must never take content offline.
  if (d.reason === "UNDERAGE" && (d.targetType === "series" || d.targetType === "episode")) {
    const isMod =
      session?.profile.role === "ADMIN" || session?.profile.role === "MODERATOR";

    let hide = isMod;
    if (!hide && session) {
      const reporters = await prisma.report
        .findMany({
          where: {
            targetType: d.targetType,
            targetId: d.targetId,
            reason: "UNDERAGE",
            reporterId: { not: null },
          },
          select: { reporterId: true },
          distinct: ["reporterId"],
        })
        .catch(() => [] as { reporterId: string | null }[]);
      hide = reporters.length >= UNDERAGE_AUTOHIDE_THRESHOLD;
    }

    if (hide) {
      if (d.targetType === "series")
        await prisma.series.update({ where: { id: d.targetId }, data: { publish: "HIDDEN" } }).catch(() => {});
      else
        await prisma.episode.update({ where: { id: d.targetId }, data: { publish: "HIDDEN" } }).catch(() => {});
    }
  }

  // Comment reports: a moderator hides it now; otherwise a threshold of distinct
  // signed-in reporters auto-hides it pending review.
  if (d.targetType === "comment") {
    const isMod =
      session?.profile.role === "ADMIN" || session?.profile.role === "MODERATOR";
    let hide = isMod;
    if (!hide && session) {
      const reporters = await prisma.report
        .findMany({
          where: { targetType: "comment", targetId: d.targetId, reporterId: { not: null } },
          select: { reporterId: true },
          distinct: ["reporterId"],
        })
        .catch(() => [] as { reporterId: string | null }[]);
      hide = reporters.length >= COMMENT_AUTOHIDE_THRESHOLD;
    }
    if (hide) {
      await prisma.comment
        .update({ where: { id: d.targetId }, data: { status: "HIDDEN" } })
        .catch(() => {});
    }
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
