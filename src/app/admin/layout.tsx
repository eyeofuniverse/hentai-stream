import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { prisma, db } from "@/lib/db";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

// queue badges — cached so every admin page nav isn't 6 count queries
const adminBadges = unstable_cache(
  () =>
    db(() =>
      Promise.all([
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.series.count({ where: { publish: "PENDING" } }),
        prisma.episode.count({ where: { publish: "PENDING" } }),
        prisma.series.count({
          where: {
            contentWarnings: { has: "possible-minor" },
            publish: { not: "REJECTED" },
          },
        }),
        prisma.series.count({
          where: {
            autoPublishedAt: { not: null },
            reviewedAt: null,
            publish: "PUBLISHED",
          },
        }),
        prisma.unmatchedTitle.count({ where: { status: "PENDING" } }),
      ]),
    ),
  ["admin-badges"],
  { revalidate: 45 },
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login");
  const role = session.profile.role;
  if (role !== "ADMIN" && role !== "MODERATOR") redirect("/");

  const [openReports, pendingSeries, pendingEps, flagged, spotCheck, unmatched] =
    await adminBadges().catch(() => [0, 0, 0, 0, 0, 0]);

  const groups: NavGroup[] = [
    {
      label: null,
      items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
    },
    {
      label: "Content",
      items: [
        {
          href: "/admin/series",
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
          href: "/admin/review",
          label: "Review queue",
          icon: "review",
          badge: flagged + spotCheck || undefined,
          tone: "pink",
        },
        {
          href: "/admin/reports",
          label: "Reports",
          icon: "reports",
          badge: openReports || undefined,
          tone: "red",
        },
        {
          href: "/admin/unmatched",
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
        { href: "/admin/tags", label: "Tags", icon: "tags" },
        { href: "/admin/search", label: "Search", icon: "search" },
      ],
    },
    {
      label: "Marketing",
      items: [{ href: "/admin/ads", label: "Ads", icon: "ads" }],
    },
    {
      label: "System",
      items: [{ href: "/admin/metadata", label: "Metadata", icon: "metadata" }],
    },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-6xl md:flex md:gap-8 md:px-4 md:py-6">
      <AdminNav groups={groups} handle={session.profile.handle} role={role} />
      <main className="min-w-0 flex-1 px-4 py-6 md:p-0">{children}</main>
    </div>
  );
}
