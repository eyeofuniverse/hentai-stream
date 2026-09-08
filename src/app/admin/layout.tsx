import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma, db } from "@/lib/db";
import { Badge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

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
    await db(() =>
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
    ).catch(() => [0, 0, 0, 0, 0, 0]);

  const nav: { href: string; label: string; badge?: number; tone?: string }[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/series", label: "Series", badge: pendingSeries + pendingEps || undefined, tone: "amber" },
    { href: "/admin/review", label: "Review queue", badge: flagged + spotCheck || undefined, tone: "pink" },
    { href: "/admin/unmatched", label: "Unmatched", badge: unmatched || undefined, tone: "amber" },
    { href: "/admin/metadata", label: "Metadata" },
    { href: "/admin/reports", label: "Reports", badge: openReports || undefined, tone: "red" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8">
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <Link href="/admin" className="text-sm font-bold tracking-tight">
            Lust<span className="text-accent">Hentai</span>
            <span className="ml-1.5 text-white/30">admin</span>
          </Link>
        </div>

        <nav className="flex flex-wrap gap-1 md:flex-col md:gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>{n.label}</span>
              {n.badge != null && (
                <Badge tone={n.tone ?? "slate"}>{n.badge}</Badge>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-4 hidden border-t border-white/8 pt-4 text-xs text-white/40 md:block">
          <div className="truncate text-white/60">@{session.profile.handle}</div>
          <div className="mt-0.5">{role}</div>
          <Link
            href="/"
            className="mt-2 inline-block text-white/40 hover:text-white"
          >
            ↗ view site
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
