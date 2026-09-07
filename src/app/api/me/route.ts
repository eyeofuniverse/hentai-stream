import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Lightweight session probe for the client-side header. */
export async function GET() {
  const s = await getSessionUser().catch(() => null);
  return NextResponse.json(
    s ? { handle: s.profile.handle, role: s.profile.role } : null,
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
