import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma, db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminNav, type NavGroup } from "@/components/console/AdminNav";

export const dynamic = "force-dynamic";

const adminBadges = unstable_cache(
  () =>
    db(() =>
      Promise.all([
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.series.count({ where: { publish: "PENDING" } }),
        prisma.episode.count({ where: { publish: "PENDING" } }),
        prisma.series.count({
          where: { contentWarnings: { has: "possible-minor" }, publish: { not: "REJECTED" } },
        }),
        prisma.series.count({
          where: { autoPublishedAt: { not: null }, reviewedAt: null, publish: "PUBLISHED" },
        }),
        prisma.unmatchedTitle.count({ where: { status: "PENDING" } }),
      ]),
    ),
  ["admin-badges"],
  { revalidate: 45 },
);

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getAdminSession();
  if (!me) redirect("/console/login");

  const [openReports, pendingSeries, pendingEps, flagged, spotCheck, unmatched] =
    await adminBadges().catch(() => [0, 0, 0, 0, 0, 0]);

  const groups: NavGroup[] = [
    { label: null, items: [{ href: "/console", label: "Dashboard", icon: "dashboard" }] },
    {
      label: "Content",
      items: [
        {
          href: "/console/series",
          label: "Series",
          icon: "series",
          badge: pendingSeries + pendingEps || undefined,
          tone: "amber",
        },
      ],
    },
    {
      label: "Moderation",
      items: [
        {
          href: "/console/review",
          label: "Review queue",
          icon: "review",
          badge: flagged + spotCheck || undefined,
          tone: "pink",
        },
        {
          href: "/console/reports",
          label: "Reports",
          icon: "reports",
          badge: openReports || undefined,
          tone: "red",
        },
        {
          href: "/console/unmatched",
          label: "Unmatched",
          icon: "unmatched",
          badge: unmatched || undefined,
          tone: "amber",
        },
      ],
    },
    {
      label: "Discovery",
      items: [
        { href: "/console/tags", label: "Tags", icon: "tags" },
        { href: "/console/search", label: "Search", icon: "search" },
      ],
    },
    { label: "Marketing", items: [{ href: "/console/ads", label: "Ads", icon: "ads" }] },
    { label: "System", items: [{ href: "/console/metadata", label: "Metadata", icon: "metadata" }] },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-6xl md:flex md:gap-8 md:px-4 md:py-6">
      <AdminNav
        groups={groups}
        handle={me.displayName ?? me.email.split("@")[0]}
        role={me.role}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:p-0">{children}</main>
    </div>
  );
}
