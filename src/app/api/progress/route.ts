import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { viewer } from "@/lib/user";

export const dynamic = "force-dynamic";

/** Records "watched" / "finished" for continue-watching + history. Silently
 *  no-ops for signed-out visitors — the /api/view counter is separate. */
export async function POST(req: Request) {
  const me = await viewer();
  if (!me) return NextResponse.json({ ok: false });

  const body = await req.json().catch(() => ({}));
  const episodeId = String(body.episodeId ?? "");
  const completed = body.completed === true;
  if (!episodeId || episodeId.length > 64)
    return NextResponse.json({ ok: false });

  const ep = await prisma.episode
    .findUnique({ where: { id: episodeId }, select: { id: true } })
    .catch(() => null);
  if (!ep) return NextResponse.json({ ok: false });

  await prisma.watchProgress
    .upsert({
      where: { profileId_episodeId: { profileId: me.id, episodeId } },
      create: { profileId: me.id, episodeId, completed, lastWatchedAt: new Date() },
      update: {
        lastWatchedAt: new Date(),
        ...(completed ? { completed: true } : {}),
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
