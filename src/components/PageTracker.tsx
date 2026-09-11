"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Fires a page-view beacon to /api/track on every route change. Never loads
 *  on /console — same rule as <Analytics /> (GA). */
export function PageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);
  // Capture document.referrer exactly once — the real external referrer from
  // whoever linked the user in (Google, Reddit, an ad network, …). Every
  // later soft navigation still reports the site's own origin here, so it's
  // only meaningful on the very first page of the session.
  const entryReferrer = useRef<string | null>(
    typeof document !== "undefined" ? document.referrer || null : null,
  );

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return;
    if (pathname.startsWith("/console")) return;

    const isFirstPage = lastTracked.current === null;
    lastTracked.current = pathname;

    const body = JSON.stringify({
      path: pathname,
      referrer: isFirstPage ? entryReferrer.current : null,
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
