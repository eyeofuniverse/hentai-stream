import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireViewer, Unauthorized } from "@/lib/user";
import { rateLimit } from "@/lib/ratelimit";
import { cleanEmoji } from "@/lib/comments";

export const dynamic = "force-dynamic";

/** Toggle one emoji reaction on a comment. Returns the fresh counts for it. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let me;
  try {
    me = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in to react" }, { status: 401 });
    throw e;
  }
  if (!rateLimit(`react:${me.id}`, 40, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { id } = await params;
  const emoji = cleanEmoji((await req.json().catch(() => ({}))).emoji);
  if (!emoji) return NextResponse.json({ error: "Not an emoji" }, { status: 400 });

  const c = await prisma.comment
    .findUnique({ where: { id }, select: { id: true, status: true } })
    .catch(() => null);
  if (!c || c.status !== "VISIBLE")
    return NextResponse.json({ error: "Comment gone" }, { status: 404 });

  const key = { commentId_profileId_emoji: { commentId: id, profileId: me.id, emoji } };
  const existing = await prisma.commentReaction.findUnique({ where: key }).catch(() => null);

  let mine: boolean;
  if (existing) {
    await prisma.commentReaction.delete({ where: key }).catch(() => {});
    mine = false;
  } else {
    // cap distinct emojis a single user can stack on one comment
    const own = await prisma.commentReaction.count({
      where: { commentId: id, profileId: me.id },
    });
    if (own >= 6) {
      return NextResponse.json({ error: "That's enough reactions" }, { status: 429 });
    }
    await prisma.commentReaction
      .create({ data: { commentId: id, profileId: me.id, emoji } })
      .catch(() => {});
    mine = true;
  }

  const count = await prisma.commentReaction.count({
    where: { commentId: id, emoji },
  });
  return NextResponse.json({ emoji, count, mine });
}
