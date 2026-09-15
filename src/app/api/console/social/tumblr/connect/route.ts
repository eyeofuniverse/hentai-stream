import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  (await cookies()).set("tumblr_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";
  const params = new URLSearchParams({
    client_id: process.env.TUMBLR_CONSUMER_KEY ?? "",
    response_type: "code",
    scope: "write offline_access",
    redirect_uri: `${site}/api/social/tumblr/callback`,
    state,
  });

  return NextResponse.redirect(`https://www.tumblr.com/oauth2/authorize?${params.toString()}`);
}
