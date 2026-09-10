"use client";

import { usePathname } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";

/**
 * GA4 measurement id. It is NOT a secret — it ships in the page source of every
 * site that uses Analytics — so hardcoding it here is fine once you have it:
 * just paste the `G-XXXXXXXXXX` value into HARDCODED_GA_ID below.
 *
 * The env var `NEXT_PUBLIC_GA_ID` still wins when set, so a preview / staging
 * deploy can point at a different property (or disable it with an empty value).
 */
const HARDCODED_GA_ID = ""; // e.g. "G-ABCD1234EF"
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || HARDCODED_GA_ID;

export function Analytics() {
  const pathname = usePathname();

  // never load analytics on the admin panel — no gtag script, no page_view,
  // no events for any /admin/* route
  if (!GA_ID || pathname?.startsWith("/admin")) return null;

  return <GoogleAnalytics gaId={GA_ID} />;
}
