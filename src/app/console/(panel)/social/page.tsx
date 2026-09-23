import { SocialSettings } from "@/components/console/SocialSettings";
import { PageHeader } from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social", robots: { index: false } };

export default function AdminSocialPage() {
  return (
    <div>
      <PageHeader
        title="Social"
        subtitle="Auto-post new series and episodes to Bluesky, or trigger a post manually from the series list."
      />
      <SocialSettings />
    </div>
  );
}
