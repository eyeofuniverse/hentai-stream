import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendConfirmSignupEmail, sendPasswordResetEmail } from "@/lib/email";
import { safeNext } from "@/lib/safe-next";

// Supabase's "Send Email" Auth Hook: instead of Supabase sending the actual
// signup-confirmation / password-reset email itself (from its own domain,
// with its own template), it calls this webhook with the token it generated
// and expects us to send the email. Supabase still owns token generation and
// verification (see /auth/confirm) — this route only owns what the email
// looks like and who it's from. Configure the hook URL + secret in the
// Supabase dashboard under Authentication > Hooks.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lusthentai.com";

interface HookPayload {
  user: { email: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "recovery" | "magiclink" | "invite" | "email_change" | "reauthentication";
  };
}

/** The `redirect_to` Supabase hands back is the full `emailRedirectTo` our
 *  client code sent, e.g. ".../auth/callback?next=/watchlist" — pull the
 *  intended `next` out of it so /auth/confirm can forward there directly. */
function extractNext(redirectTo: string): string {
  try {
    return safeNext(new URL(redirectTo).searchParams.get("next"));
  } catch {
    return "/";
  }
}

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error("[email-hook] SUPABASE_AUTH_HOOK_SECRET is not set");
    return NextResponse.json({ error: { http_code: 500, message: "hook not configured" } }, { status: 500 });
  }

  const body = await req.text();
  try {
    // Supabase's dashboard shows this as "v1,whsec_..." — the library only
    // strips a bare "whsec_" prefix itself, not the version tag in front of
    // it, so a secret pasted verbatim from the dashboard would otherwise
    // fail to base64-decode.
    const wh = new Webhook(secret.replace(/^v1,/, ""));
    wh.verify(body, Object.fromEntries(req.headers));
  } catch {
    return NextResponse.json({ error: { http_code: 401, message: "invalid signature" } }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: { http_code: 400, message: "bad payload" } }, { status: 400 });
  }

  const { user, email_data } = payload;
  const next = extractNext(email_data.redirect_to);
  const confirmUrl = `${SITE}/auth/confirm?token_hash=${encodeURIComponent(email_data.token_hash)}&type=${encodeURIComponent(email_data.email_action_type)}&next=${encodeURIComponent(next)}`;

  try {
    if (email_data.email_action_type === "recovery") {
      await sendPasswordResetEmail(user.email, confirmUrl);
    } else {
      // signup (and, as a reasonable fallback, any other link-based type —
      // this app only ever triggers signup/recovery, but a real link beats
      // silently dropping something we didn't anticipate)
      await sendConfirmSignupEmail(user.email, confirmUrl);
    }
  } catch (e) {
    console.error("[email-hook] send failed:", e);
    return NextResponse.json({ error: { http_code: 500, message: "email send failed" } }, { status: 500 });
  }

  return NextResponse.json({});
}
