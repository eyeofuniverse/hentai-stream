import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireViewer, Unauthorized } from "@/lib/user";
import { rateLimit } from "@/lib/ratelimit";
import { cleanBody } from "@/lib/comments";

export const dynamic = "force-dynamic";

function isModerator(role: string) {
  return role === "MODERATOR" || role === "ADMIN";
}

/* ── edit (author only) ── */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let viewer;
  try {
    viewer = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    throw e;
  }
  if (!rateLimit(`comment-edit:${viewer.id}`, 15, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { id } = await params;
  const body = cleanBody((await req.json().catch(() => ({}))).body);
  if (!body) return NextResponse.json({ error: "Empty" }, { status: 400 });

  const c = await prisma.comment
    .findUnique({ where: { id }, select: { profileId: true, status: true } })
    .catch(() => null);
  if (!c || c.status !== "VISIBLE")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.profileId !== viewer.id)
    return NextResponse.json({ error: "Not yours" }, { status: 403 });

  const updated = await prisma.comment.update({
    where: { id },
    data: { body, edited: true },
    select: { id: true, body: true, edited: true },
  });
  return NextResponse.json(updated);
}

/* ── delete (author or moderator). Hard delete — DB cascades to replies + reactions. ── */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let viewer;
  try {
    viewer = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const c = await prisma.comment
    .findUnique({ where: { id }, select: { profileId: true } })
    .catch(() => null);
  if (!c) return NextResponse.json({ ok: true }); // already gone

  if (c.profileId !== viewer.id && !isModerator(viewer.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
