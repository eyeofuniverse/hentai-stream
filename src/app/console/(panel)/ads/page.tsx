import { AdsManager } from "@/components/console/AdsManager";
import { VastAdsSettings } from "@/components/console/VastAdsSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ads", robots: { index: false } };

export default function AdminAdsPage() {
  return (
    <div>
      <AdsManager />
      <VastAdsSettings />
    </div>
  );
}
