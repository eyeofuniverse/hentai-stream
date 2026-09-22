import { isAutomated } from "@/lib/isAutomated";

type Pending = [name: string, params: Record<string, unknown> | undefined];

declare global {
  interface Window {
    dataLayer?: unknown[];
    /** set by the ga-init script in Analytics.tsx once gtag('config') is queued */
    __gaReady?: boolean;
    __gaPending?: Pending[];
  }
}

/**
 * Sends a GA4 custom event through the gtag.js queue. Two gotchas, both
 * confirmed live (the hits silently never went out):
 *
 * 1. gtag.js only processes `arguments` objects — exactly what its own
 *    `gtag()` pushes — and ignores plain arrays like `["event", name, {…}]`.
 * 2. Events queued before `gtag('config')` are dropped. gtag.js loads async
 *    (see Analytics.tsx), so a component that fires on mount can still run
 *    before the init script has — those events wait in `__gaPending` and
 *    the init script flushes them right after `config`.
 *
 * Skips automation, same as Analytics.tsx: these hits go straight from the
 * browser to Google, so nothing on our backend can gate them.
 */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || isAutomated()) return;
  try {
    if (!window.__gaReady) {
      (window.__gaPending ||= []).push([name, params]);
      return;
    }
    window.dataLayer = window.dataLayer || [];
    (function gtag(..._args: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    })("event", name, params);
  } catch {
    /* analytics must never break the page */
  }
}
