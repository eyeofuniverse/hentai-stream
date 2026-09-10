import { AdsManager } from "@/components/console/AdsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ads", robots: { index: false } };

export default function AdminAdsPage() {
  return <AdsManager />;
}
