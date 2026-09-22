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

  // "afterInteractive", not "lazyOnload": lazyOnload waits for true browser
  // idle, which on this site means queuing behind ad-zone scripts, the
  // popunder, and the video player — measured live taking 5-7s to even start.
  // Median real page-view duration here is 7s and ~50% of visits are under
  // that, so lazyOnload was silently dropping roughly half of all traffic
  // from Analytics, not just delaying it. afterInteractive is the standard
  // choice for GA (what Google's own Next.js integration uses) and loads
  // in well under a second instead.
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      {/* gtag hits go straight from the browser to Google — nothing on our
          backend gates them, so the webdriver check has to live here. Real
          visitors never trip it (no headless browser has a human behind it);
          see src/lib/isAutomated.ts for the reasoning. */}
      {/* After config, flush events components queued while this script was
          still waiting to load (see src/lib/ga.ts) and mark GA ready so later
          events go straight through. */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}if(!navigator.webdriver){gtag('js',new Date());gtag('config','${GA_ID}');window.__gaReady=true;var p=window.__gaPending||[];window.__gaPending=[];for(var i=0;i<p.length;i++){gtag('event',p[i][0],p[i][1]);}}`}
      </Script>
    </>
  );
}
