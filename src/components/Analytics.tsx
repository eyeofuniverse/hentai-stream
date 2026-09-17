"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * GA4 measurement id. It is NOT a secret — it ships in the page source of every
 * site that uses Analytics — so hardcoding it here is fine once you have it:
 * just paste the `G-XXXXXXXXXX` value into HARDCODED_GA_ID below.
 *
 * The env var `NEXT_PUBLIC_GA_ID` still wins when set, so a preview / staging
 * deploy can point at a different property (or disable it with an empty value).
 */
const HARDCODED_GA_ID = "G-WM996JRN9T";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || HARDCODED_GA_ID;

export function Analytics() {
  const pathname = usePathname();

  // never load analytics on the admin panel — no gtag script, no page_view,
  // no events for any /console/* route
  if (!GA_ID || pathname?.startsWith("/console")) return null;

  // "lazyOnload" (loaded when the browser is idle, after everything else)
  // instead of @next/third-parties' fixed "afterInteractive" — gtag.js is
  // ~167KB with a real chunk of that unused, and its execution was showing
  // up as a meaningful share of Total Blocking Time. Analytics firing a
  // couple seconds later doesn't cost us anything real; competing with
  // actual page content for the main thread does.
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
      {/* gtag hits go straight from the browser to Google — nothing on our
          backend gates them, so the webdriver check has to live here. Real
          visitors never trip it (no headless browser has a human behind it);
          see src/lib/isAutomated.ts for the reasoning. */}
      <Script id="ga-init" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}if(!navigator.webdriver){gtag('js',new Date());gtag('config','${GA_ID}');}`}
      </Script>
    </>
  );
}
