import "server-only";
import { prisma } from "@/lib/db";

const authorSel = {
  handle: true,
  displayName: true,
} as const;

/** Comments the operator should look at: open reports first, then anything the
 *  auto-hide threshold caught. */
export async function moderationQueue() {
  const reportRows = await prisma.report.findMany({
    where: { targetType: "comment", status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { targetId: true, reason: true, details: true, createdAt: true },
  });

  // auto-hidden comments that still have an open report belong in "Reported"
  // (below) — excluding them here stops the same comment appearing twice.
  const openReportedIds = [...new Set(reportRows.map((r) => r.targetId))];
  const hidden = await prisma.comment.findMany({
    where: { status: "HIDDEN", id: { notIn: openReportedIds } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      profile: { select: authorSel },
    },
  });

  const byComment = new Map<
    string,
    { count: number; reasons: Record<string, number>; last: Date }
  >();
  for (const r of reportRows) {
    const e = byComment.get(r.targetId) ?? { count: 0, reasons: {}, last: r.createdAt };
    e.count++;
    e.reasons[r.reason] = (e.reasons[r.reason] ?? 0) + 1;
    if (r.createdAt > e.last) e.last = r.createdAt;
    byComment.set(r.targetId, e);
  }

  const reportedIds = [...byComment.keys()];
  const reported = reportedIds.length
    ? await prisma.comment.findMany({
        where: { id: { in: reportedIds } },
        select: {
          id: true,
          body: true,
          status: true,
          createdAt: true,
          targetType: true,
          targetId: true,
          profile: { select: authorSel },
          _count: { select: { replies: true } },
        },
      })
    : [];

  return {
    reported: reported
      .map((c) => ({ ...c, report: byComment.get(c.id)! }))
      .sort((a, b) => b.report.count - a.report.count),
    hidden,
  };
}
