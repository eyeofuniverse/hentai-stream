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

  // legacy single-filter /browse?query URLs → their dedicated indexable page.
  // Has to happen here, not in browse/page.tsx: that route has a loading.tsx
  // sibling, so by the time the page component's data resolves and calls
  // redirect(), Next has already started streaming a 200 shell — the
  // redirect still "works" as a client-side navigation, but a crawler
  // reading the raw HTTP status never sees a real 3xx. Middleware runs
  // before any of that, so it can issue one for real.
  if (pathname === "/browse") {
    const keys = [...searchParams.keys()].filter((k) => k !== "page");
    if (keys.length === 1) {
      const k = keys[0];
      const v = searchParams.get(k) ?? "";
      const page = searchParams.get("page");
      const suffix = page && page !== "1" ? `?page=${page}` : "";
      const dest =
        k === "sort" && v === "new"
          ? "/browse/new"
          : k === "sort" && v === "trending"
            ? "/browse/trending"
            : k === "censored" && v === "false"
              ? "/browse/uncensored"
              : k === "year" && /^\d{4}$/.test(v)
                ? `/browse/year/${v}`
                : null;
      if (dest) {
        const url = req.nextUrl.clone();
        url.pathname = dest;
        url.search = suffix;
        return NextResponse.redirect(url, 308);
      }
    }
  }

  // /browse/year/[year] inherits the same loading.tsx boundary, so its own
  // notFound() for a malformed year has the same problem redirect() did
  // above — the 404 status never actually reaches a crawler. Validate here.
  const yearMatch = pathname.match(/^\/browse\/year\/([^/]+)$/);
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    const validYear = Number.isInteger(y) && y >= 1980 && y <= new Date().getUTCFullYear() + 1;
    if (!validYear) return new NextResponse(null, { status: 404 });
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
    "/history/:path*",
    "/account/:path*",
    "/submit/:path*",
    "/auth/:path*",
    "/browse",
    "/browse/year/:path*",
  ],
};
