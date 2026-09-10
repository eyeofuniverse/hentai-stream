import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { viewer, requireViewer, Unauthorized } from "@/lib/user";
import { rateLimit } from "@/lib/ratelimit";
import {
  getComments,
  commentCount,
  cleanBody,
  type CommentTarget,
} from "@/lib/comments";

export const dynamic = "force-dynamic";

const TARGETS: CommentTarget[] = ["series", "episode"];

function isTarget(v: string): v is CommentTarget {
  return (TARGETS as string[]).includes(v);
}

/* ── list ── */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const targetType = u.searchParams.get("targetType") ?? "";
  const targetId = u.searchParams.get("targetId") ?? "";
  const sortParam = u.searchParams.get("sort") ?? "new";
  const sort = (["new", "old", "top"] as const).includes(sortParam as never)
    ? (sortParam as "new" | "old" | "top")
    : "new";
  const cursor = u.searchParams.get("cursor");

  if (!isTarget(targetType) || !targetId || targetId.length > 64) {
    return NextResponse.json({ error: "Bad target" }, { status: 400 });
  }

  const me = await viewer();
  const [data, total] = await Promise.all([
    getComments({ targetType, targetId, sort, cursor, meId: me?.id ?? null }),
    cursor ? Promise.resolve(null) : commentCount(targetType, targetId),
  ]);

  return NextResponse.json(
    {
      ...data,
      total,
      signedIn: !!me,
      canModerate: me?.role === "MODERATOR" || me?.role === "ADMIN",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/* ── create ── */
export async function POST(req: Request) {
  let me;
  try {
    me = await requireViewer();
  } catch (e) {
    if (e instanceof Unauthorized)
      return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
    throw e;
  }
  if (!rateLimit(`comment:${me.id}`, 6, 60_000)) {
    return NextResponse.json({ error: "You're commenting too fast" }, { status: 429 });
  }

  const raw = await req.json().catch(() => ({}));
  const targetType = String(raw.targetType ?? "");
  const targetId = String(raw.targetId ?? "");
  const body = cleanBody(raw.body);
  const parentIdIn = raw.parentId ? String(raw.parentId) : null;

  if (!isTarget(targetType) || !targetId) {
    return NextResponse.json({ error: "Bad target" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "Say something first" }, { status: 400 });
  }

  const target =
    targetType === "series"
      ? await prisma.series
          .findFirst({ where: { id: targetId, publish: "PUBLISHED" }, select: { id: true } })
          .catch(() => null)
      : await prisma.episode
          .findFirst({
            where: { id: targetId, publish: "PUBLISHED", series: { publish: "PUBLISHED" } },
            select: { id: true },
          })
          .catch(() => null);
  if (!target) {
    return NextResponse.json({ error: "That page isn't available" }, { status: 404 });
  }

  // normalise the parent to a top-level comment on the SAME target (max depth 2)
  let parentId: string | null = null;
  if (parentIdIn) {
    const parent = await prisma.comment
      .findUnique({
        where: { id: parentIdIn },
        select: { id: true, parentId: true, targetType: true, targetId: true, status: true },
      })
      .catch(() => null);
    if (
      !parent ||
      parent.status !== "VISIBLE" ||
      parent.targetType !== targetType ||
      parent.targetId !== targetId
    ) {
      return NextResponse.json({ error: "That comment is gone" }, { status: 409 });
    }
    parentId = parent.parentId ?? parent.id;
  }

  // dedupe: identical text to this user's last comment on the target in 5 min
  const dupe = await prisma.comment
    .findFirst({
      where: {
        profileId: me.id,
        targetType,
        targetId,
        body,
        createdAt: { gt: new Date(Date.now() - 5 * 60_000) },
      },
      select: { id: true },
    })
    .catch(() => null);
  if (dupe) {
    return NextResponse.json({ error: "You just posted that" }, { status: 409 });
  }

  const c = await prisma.comment.create({
    data: { targetType, targetId, profileId: me.id, parentId, body },
    select: {
      id: true,
      parentId: true,
      body: true,
      edited: true,
      createdAt: true,
      profileId: true,
      profile: {
        select: { handle: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: c.id,
      parentId: c.parentId,
      body: c.body,
      edited: c.edited,
      createdAt: c.createdAt.toISOString(),
      author: c.profile,
      isMine: true,
      reactions: [],
      replyCount: 0,
    },
    { status: 201 },
  );
}
