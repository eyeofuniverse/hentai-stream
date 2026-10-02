import { NextResponse } from "next/server";
import { prisma, db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Click-through redirect for affiliate (image+link) ads — counts the click
 *  then sends the visitor on to the real destination. Raw network (iframe/
 *  script) ads skip this entirely and link straight out, since the ad
 *  network already tracks those clicks on its own side. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ad = await prisma.ad.findUnique({
    where: { id },
    select: { isActive: true, type: true, linkUrl: true },
  });
  if (!ad || !ad.isActive || ad.type !== "affiliate" || !ad.linkUrl) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // a malformed destination (saved without validation in the admin UI)
  // would otherwise throw inside NextResponse.redirect() and 500 on every
  // single click instead of just falling through
  let destination: URL;
  try {
    destination = new URL(ad.linkUrl);
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // this is a rare, one-off navigation (unlike impression counting on the
  // hot ad-serving path) — worth the small latency to await it, since a
  // fire-and-forget write here can get dropped when the serverless function
  // freezes right after the response is sent
  await db(() => prisma.ad.update({ where: { id }, data: { clicks: { increment: 1 } } })).catch(
    () => {},
  );

  return NextResponse.redirect(destination);
}
