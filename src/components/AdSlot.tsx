import { getAdConfig, pickVariant } from "@/lib/ads";
import { AdUnit } from "@/components/ads/AdUnit";

/**
 * A named ad position. Reads the live config (admin panel → Setting "ads"),
 * renders the desktop and/or mobile variant, or nothing when the slot is off.
 * Wrap with your own spacing via `className`; it renders nothing at all when
 * empty so there's no stray gap.
 */
export async function AdSlot({
  slotKey,
  className = "",
}: {
  slotKey: string;
  className?: string;
}) {
  const cfg = await getAdConfig();
  const desktop = pickVariant(cfg, slotKey, "desktop");
  const mobile = pickVariant(cfg, slotKey, "mobile");
  if (!desktop && !mobile) return null;

  return (
    <div className={`ad-slot ${className}`} aria-hidden="true">
      {mobile && (
        <div className={desktop ? "lg:hidden" : ""}>
          <AdUnit slotKey={slotKey} variant={mobile} />
        </div>
      )}
      {desktop && (
        <div className={mobile ? "hidden lg:block" : ""}>
          <AdUnit slotKey={slotKey} variant={desktop} />
        </div>
      )}
    </div>
  );
}
