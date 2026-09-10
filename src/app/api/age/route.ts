import { NextResponse } from "next/server";

/**
 * The age gate sets its cookie from JS for an instant response, but Safari's ITP
 * caps script-written cookies at 7 days — so returning visitors keep seeing the
 * gate. This route re-sets the same cookie from a server `Set-Cookie`, which is
 * not subject to that cap, so the confirmation actually sticks.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("lh_vok", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // 400 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  return res;
}
