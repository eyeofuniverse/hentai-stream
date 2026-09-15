import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Tumblr's OAuth redirect lands here. Deliberately NOT under /api/console/*
 * — that whole prefix is cloaked by middleware (404 without a same-site
 * session/gate cookie), but this is a cross-site redirect from tumblr.com,
 * and our admin cookies are sameSite:"strict" so they never arrive here.
 * The random `state` value round-tripped through the httpOnly, sameSite:
 * "lax" `tumblr_oauth_state` cookie (set by the admin-authenticated
 * /api/console/social/tumblr/connect step, which IS same-site) is what
 * actually proves this request follows an admin-initiated connect — that
 * cookie does survive the cross-site hop, unlike the strict ones.
 */
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";
  const redirect = (status: string) => NextResponse.redirect(`${site}/console/social?tumblr=${status}`);

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
        redirect_uri: `${site}/api/social/tumblr/callback`,
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
