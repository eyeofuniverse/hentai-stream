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

  const brand = (
    <Link href="/admin" className="text-sm font-bold tracking-tight">
      Lust<span className="text-accent">Hentai</span>
      <span className="ml-1.5 font-medium text-white/30">admin</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl md:flex md:gap-8 md:px-4 md:py-6">
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-bg/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {brand}
          <span className="text-xs text-white/35">@{session.profile.handle}</span>
        </div>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/65"
            >
              {n.label}
              {n.badge != null && <Badge tone={n.tone ?? "slate"}>{n.badge}</Badge>}
            </Link>
          ))}
        </nav>
      </header>

      {/* desktop sidebar */}
      <aside className="hidden md:block md:w-52 md:shrink-0">
        <div className="mb-6">{brand}</div>
        <nav className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>{n.label}</span>
              {n.badge != null && <Badge tone={n.tone ?? "slate"}>{n.badge}</Badge>}
            </Link>
          ))}
        </nav>
        <div className="mt-5 border-t border-white/8 pt-4 text-xs text-white/40">
          <div className="truncate text-white/60">@{session.profile.handle}</div>
          <div className="mt-0.5">{role}</div>
          <Link href="/" className="mt-2 inline-block text-white/40 hover:text-white">
            ↗ view site
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:p-0">{children}</main>
    </div>
  );
}
