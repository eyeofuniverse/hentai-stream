"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function inject(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("script").forEach((orig) => {
    const s = document.createElement("script");
    if (orig.src) {
      s.src = orig.src;
      s.async = orig.async;
    } else {
      s.textContent = orig.textContent;
    }
    Array.from(orig.attributes).forEach((a) => {
      if (a.name !== "src" && a.name !== "async") s.setAttribute(a.name, a.value);
    });
    document.head.appendChild(s);
  });
}

/**
 * Site-wide pop-under. Loads the `global-popunder` slot's network code once per
 * page load (never on /console). Frequency capping is the ad network's job — set
 * it in the ExoClick zone.
 */
export function GlobalPopUnder() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/console")) return;
    // A popunder doesn't need to be armed the instant the page mounts — it
    // fires on exit/click intent regardless, not on a load timer. Deferring
    // the fetch + script injection to an idle moment keeps this off the
    // critical rendering path instead of competing with real content for
    // main-thread time right when Lighthouse (and real users) are measuring
    // Total Blocking Time.
    const load = () => {
      fetch("/api/ads/active?slot=global-popunder&device=all")
        .then((r) => (r.ok ? r.json() : null))
        .then((ad) => {
          if (ad?.type === "network" && ad.networkCode) inject(ad.networkCode);
        })
        .catch(() => {});
    };
    const ric = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
    const cic = window.cancelIdleCallback ?? clearTimeout;
    const id = ric(load, { timeout: 4000 });
    return () => cic(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
