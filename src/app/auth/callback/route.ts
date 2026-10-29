import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SITE } from "@/lib/seo";

/** Email-confirmation / password-reset / OAuth redirect target.
 *  Exchanges the code for a session, then bounces to `next`. */
export async function GET(request: Request) {
  // the public address, not the one in request.url: behind our own proxy that is http://0.0.0.0:3000
  const { searchParams } = new URL(request.url);
  const origin = SITE;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
