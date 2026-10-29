import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SITE } from "@/lib/seo";

/** Where the emailed link from api/auth/email-hook actually lands — verifies
 *  the token Supabase generated (we never see or handle the token ourselves,
 *  only the email around it) and establishes the session. */
export async function GET(request: Request) {
  // the public address, not the one in request.url: behind our own proxy that is http://0.0.0.0:3000
  const { searchParams } = new URL(request.url);
  const origin = SITE;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
