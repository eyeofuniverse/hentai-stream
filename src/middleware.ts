import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { signGate, verifyGate, tokenEqual } from "@/lib/admin/gate";

const PROD = process.env.NODE_ENV === "production";
const SESSION_COOKIE = PROD ? "__Host-lhc_session" : "lhc_session";
const GATE_COOKIE = PROD ? "__Host-lhc_gate" : "lhc_gate";
const ENTRY_TOKEN = process.env.ADMIN_ENTRY_TOKEN || "";

const cookieOpts = {
  httpOnly: true,
  secure: PROD,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 30 * 60,
};

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isConsole =
    pathname === "/console" ||
    pathname.startsWith("/console/") ||
    pathname.startsWith("/api/console/");

  if (isConsole) {
    // secret entry: /console?k=<ADMIN_ENTRY_TOKEN> → stamp a gate cookie, clean the URL
    const k = searchParams.get("k");
    if (k && ENTRY_TOKEN && tokenEqual(k, ENTRY_TOKEN)) {
      const url = req.nextUrl.clone();
      url.search = "";
      url.pathname = "/console";
      const res = NextResponse.redirect(url);
      res.cookies.set(GATE_COOKIE, await signGate(), cookieOpts);
      return res;
    }

    // cloak: without a session cookie or a valid gate, the console does not exist
    const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
    const gateOk = await verifyGate(req.cookies.get(GATE_COOKIE)?.value);
    if (!hasSession && !gateOk) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // Supabase cookie refresh for the public authenticated areas
  return updateSession(req);
}

export const config = {
  matcher: [
    "/console",
    "/console/:path*",
    "/api/console/:path*",
    "/watchlist/:path*",
    "/submit/:path*",
    "/auth/:path*",
  ],
};
