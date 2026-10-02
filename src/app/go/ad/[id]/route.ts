import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Click-through redirect for affiliate (image+link) ads — counts the click
 *  then sends the visitor on to the real destination. Raw network (iframe/
 *  script) ads skip this entirely and link straight out, since the ad
 *  network already tracks those clicks on its own side. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ad = await prisma.ad.findUnique({
    where: { id },
    select: { isActive: true, type: true, linkUrl: true },
  });
  if (!ad || !ad.isActive || ad.type !== "affiliate" || !ad.linkUrl) {
    return NextResponse.redirect(new URL("/", _req.url));
  }
  prisma.ad.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => {});
  return NextResponse.redirect(ad.linkUrl);
}
