"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isAutomated } from "@/lib/isAutomated";

type Open = {
  path: string;
  /** stable per logical page visit — lets the server upsert instead of
   *  inserting a new row every time this same visit's dwell segment flushes */
  visitId: string;
  referrer: string | null;
  /** when this page visit started — fixed, doesn't move on background/resume */
  enteredAt: number;
  /** resets each time the tab regains visibility — start of the current
   *  active (foreground) segment */
  segmentStart: number;
  /** active seconds already flushed for this visit, from earlier segments */
  accumulatedSec: number;
};

function newVisitId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function send(open: Open, extraSec: number) {
  if (isAutomated()) return;
  const duration = Math.max(0, Math.round(open.accumulatedSec + extraSec));
  const body = JSON.stringify({
    visitId: open.visitId,
    path: open.path,
    referrer: open.referrer,
    enteredAt: open.enteredAt,
    duration,
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
}

/**
 * Reports a page view to /api/track once the visitor LEAVES it — on the next
 * route change, or on tab-hide/close for the last page of a session — rather
 * than on arrival, so every row carries how long they actually spent on it.
 * visibilitychange (not beforeunload, unreliable on mobile Safari) is the
 * standard reliable "the user is leaving" signal; pagehide is a second catch
 * for cases that skip straight to unload without a visibility transition.
 *
 * Backgrounding a tab and returning to it is NOT a new visit — the segment
 * stays open (same visitId) across hide/show cycles, just pausing its timer,
 * so alt-tabbing back and forth doesn't fragment one real visit into several
 * rows. Each hide still flushes a beacon as a safety net in case the tab
 * never comes back, but the server upserts by visitId instead of inserting,
 * so a resumed tab only ever extends that one row's duration.
 */
export function PageTracker() {
  const pathname = usePathname();
  const openRef = useRef<Open | null>(null);
  // Real external referrer, captured once — every later soft navigation's
  // document.referrer would just be this site's own previous page.
  const entryReferrer = useRef<string | null>(
    typeof document !== "undefined" ? document.referrer || null : null,
  );
  const isFirstPage = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/console")) {
      openRef.current = null;
      return;
    }

    const prev = openRef.current;
    if (prev && prev.path !== pathname) {
      send(prev, (Date.now() - prev.segmentStart) / 1000);
    }
    if (!prev || prev.path !== pathname) {
      const now = Date.now();
      openRef.current = {
        path: pathname,
        visitId: newVisitId(),
        enteredAt: now,
        segmentStart: now,
        accumulatedSec: 0,
        referrer: isFirstPage.current ? entryReferrer.current : null,
      };
      isFirstPage.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    const closeOut = () => {
      const open = openRef.current;
      if (!open) return;
      send(open, (Date.now() - open.segmentStart) / 1000);
      openRef.current = null;
    };
    const onVisibility = () => {
      const open = openRef.current;
      if (!open) return;
      if (document.visibilityState === "hidden") {
        const extraSec = (Date.now() - open.segmentStart) / 1000;
        send(open, extraSec);
        open.accumulatedSec += extraSec; // segment stays open — same visitId
      } else if (document.visibilityState === "visible") {
        open.segmentStart = Date.now(); // resume the clock, no new row
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", closeOut);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", closeOut);
    };
  }, []);

  return null;
}
