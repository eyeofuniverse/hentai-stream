import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight session probe for the header. Uses getSession() (reads the cookie,
 * no round-trip to Supabase Auth) — this only decides which button to show, not
 * access to anything, so it doesn't need the full getUser() verification. The
 * middleware already refreshes the token on protected routes.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return NextResponse.json(null, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const profile = await prisma.profile
      .findUnique({
        where: { id: user.id },
        select: { handle: true, role: true, displayName: true, avatarUrl: true },
      })
      .catch(() => null);

    return NextResponse.json(
      profile
        ? {
            handle: profile.handle,
            role: profile.role,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        : {
            handle: (user.email ?? "you").split("@")[0],
            role: "USER",
            displayName: null,
            avatarUrl: null,
          },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(null, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
