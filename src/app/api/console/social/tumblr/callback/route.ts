import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";
  const redirect = (status: string) => NextResponse.redirect(`${site}/console/social?tumblr=${status}`);

  try {
    await requireAdmin();
  } catch {
    return redirect("error");
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  if (error) return redirect("denied");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("tumblr_oauth_state")?.value;
  if (!code || !state || state !== storedState) return redirect("error");

  try {
    const tokenRes = await fetch("https://api.tumblr.com/v2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.TUMBLR_CONSUMER_KEY ?? "",
        client_secret: process.env.TUMBLR_CONSUMER_SECRET ?? "",
        redirect_uri: `${site}/api/console/social/tumblr/callback`,
      }),
    });
    if (!tokenRes.ok) return redirect("error");

    const tokens = await tokenRes.json();

    await prisma.socialToken.upsert({
      where: { platform: "tumblr" },
      create: {
        platform: "tumblr",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      },
    });

    cookieStore.delete("tumblr_oauth_state");
    return redirect("connected");
  } catch {
    return redirect("error");
  }
}
