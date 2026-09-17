"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isAutomated } from "@/lib/isAutomated";

type Open = { path: string; enteredAt: number; referrer: string | null };

function send(path: string, enteredAt: number, referrer: string | null) {
  if (isAutomated()) return;
  const duration = Math.round((Date.now() - enteredAt) / 1000);
  const body = JSON.stringify({ path, referrer, enteredAt, duration });
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
 * than on arrival, so every row carries how long they actually spent on it
 * (previously never tracked at all). visibilitychange (not beforeunload,
 * unreliable on mobile Safari) is the standard reliable "the user is
 * leaving" signal; pagehide is a second catch for cases that skip straight
 * to unload without a visibility transition.
 */
export function PageTracker() {
  const pathname = usePathname();
  const openRef = useRef<Open | null>(null);
  const pathRef = useRef<string | null>(null);
  const isFirstPage = useRef(true);
  // Real external referrer, captured once — every later soft navigation's
  // document.referrer would just be this site's own previous page.
  const entryReferrer = useRef<string | null>(
    typeof document !== "undefined" ? document.referrer || null : null,
  );

  useEffect(() => {
    if (!pathname) return;
    pathRef.current = pathname;
    if (pathname.startsWith("/console")) {
      openRef.current = null;
      return;
    }

    const prev = openRef.current;
    if (prev && prev.path !== pathname) {
      send(prev.path, prev.enteredAt, prev.referrer);
    }
    openRef.current = {
      path: pathname,
      enteredAt: Date.now(),
      referrer: isFirstPage.current ? entryReferrer.current : null,
    };
    isFirstPage.current = false;
  }, [pathname]);

  useEffect(() => {
    const flush = () => {
      const open = openRef.current;
      if (!open) return;
      send(open.path, open.enteredAt, open.referrer);
      openRef.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      } else if (
        document.visibilityState === "visible" &&
        !openRef.current &&
        pathRef.current &&
        !pathRef.current.startsWith("/console")
      ) {
        // Resumed a backgrounded tab on the same page (visiblity->hidden
        // already flushed and closed it out) — open a fresh dwell segment
        // rather than leaving this page permanently untracked. Undercounts
        // cumulative time across background/foreground cycles slightly, but
        // never silently drops the page's remaining time entirely.
        openRef.current = { path: pathRef.current, enteredAt: Date.now(), referrer: null };
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
