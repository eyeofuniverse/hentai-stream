import { AdsManager } from "@/components/admin/AdsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ads", robots: { index: false } };

export default function AdminAdsPage() {
  return <AdsManager />;
}
