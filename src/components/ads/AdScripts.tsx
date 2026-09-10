import Script from "next/script";
import { getAdConfig } from "@/lib/ads";
import { Popunder } from "@/components/ads/Popunder";

/** Site-wide ad bootstrap: the network provider script + the popunder. */
export async function AdScripts() {
  const cfg = await getAdConfig();
  if (!cfg.enabled) return null;

  return (
    <>
      {cfg.providerScript && (
        <Script
          id="ad-provider"
          src={cfg.providerScript}
          strategy="afterInteractive"
          async
        />
      )}
      {cfg.popunder.enabled &&
        (cfg.popunder.zoneId || cfg.popunder.code) && (
          <Popunder
            source={cfg.popunder.source}
            zoneId={cfg.popunder.zoneId}
            code={cfg.popunder.code}
            cooldownHours={cfg.popunder.cooldownHours}
          />
        )}
    </>
  );
}
