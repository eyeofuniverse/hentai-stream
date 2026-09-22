"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Yandex Metrica counter id. Not a secret — ships in every page's source,
 * same reasoning as Analytics.tsx's GA_ID.
 */
const YM_ID = process.env.NEXT_PUBLIC_YM_ID || "112934580";

export function YandexMetrica() {
  const pathname = usePathname();

  // same rule as Analytics.tsx: never on the admin panel
  if (!YM_ID || pathname?.startsWith("/console")) return null;

  return (
    <>
      {/* afterInteractive, not lazyOnload — see Analytics.tsx's comment: lazyOnload
          measurably dropped ~half of real visits on this site by loading too late. */}
      <Script id="ym-init" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}', 'ym');
        if (!navigator.webdriver) {
          ym(${YM_ID}, 'init', {ssr:true, webvisor:false, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
        }`}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YM_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
