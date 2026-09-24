import { NextResponse } from "next/server";
import { getRotatedAdDomain } from "@/lib/adblock";

export const dynamic = "force-dynamic";

/** Called only when the client detected its own adblocker blocked our bait
 *  script (see AdblockProvider) — same-origin, so it's never itself a
 *  blockable request the way a direct call to ExoClick would be. */
export async function GET() {
  const domain = await getRotatedAdDomain();
  return NextResponse.json(
    { domain },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
