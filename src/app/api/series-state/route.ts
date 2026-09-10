import { NextResponse } from "next/server";
import { viewer } from "@/lib/user";
import { mySeriesState } from "@/lib/user-queries";

export const dynamic = "force-dynamic";

/** The viewer's watchlist status + rating for one series. Keeps the series page
 *  itself static/ISR — the personalised bits load client-side. */
export async function GET(req: Request) {
  const seriesId = new URL(req.url).searchParams.get("seriesId") ?? "";
  const me = await viewer();
  const headers = { "Cache-Control": "private, no-store" };
  if (!me || !seriesId) {
    return NextResponse.json({ signedIn: !!me, listStatus: null, myRating: null }, { headers });
  }
  const s = await mySeriesState(me.id, seriesId);
  return NextResponse.json({ signedIn: true, ...s }, { headers });
}
