import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/** action: "delete" (hard, cascades) | "hide" | "restore" | "keep" (dismiss reports) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const action = String((await req.json().catch(() => ({}))).action ?? "");

  const resolveReports = () =>
    prisma.report.updateMany({
      where: { targetType: "comment", targetId: id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

  if (action === "delete") {
    await resolveReports().catch(() => {}); // reports first — the FK is SetNull, but a hard delete cascades replies which could carry their own reports
    await prisma.comment.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (action === "hide") {
    await prisma.comment
      .update({ where: { id }, data: { status: "HIDDEN" } })
      .catch(() => {});
    await resolveReports().catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    await prisma.comment
      .update({ where: { id }, data: { status: "VISIBLE" } })
      .catch(() => {});
    await resolveReports().catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (action === "keep") {
    await resolveReports().catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
