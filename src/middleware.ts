import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the routes that read the server-side session need cookie refresh.
  // Public content pages are cached and do no auth work.
  matcher: ["/admin/:path*", "/watchlist/:path*", "/submit/:path*", "/auth/:path*"],
};
