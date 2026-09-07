import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AdminHome() {
  const [series, episodes, sources, pendingSeries, pendingEps, openReports, deadSources] =
    await Promise.all([
      prisma.series.count(),
      prisma.episode.count(),
      prisma.videoSource.count(),
      prisma.series.count({ where: { publish: "PENDING" } }),
      prisma.episode.count({ where: { publish: "PENDING" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.videoSource.count({ where: { status: "DEAD" } }),
    ]);

  const stat = (label: string, value: number, href?: string, alert?: boolean) => (
    <Link
      href={href ?? "#"}
      className={`rounded-xl border p-4 ${
        alert && value > 0 ? "border-accent/50 bg-accent/10" : "border-white/10 bg-surface"
      }`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </Link>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Series", series, "/admin/series")}
        {stat("Episodes", episodes, "/admin/series")}
        {stat("Sources", sources)}
        {stat("Open reports", openReports, "/admin/reports", true)}
        {stat("Pending series", pendingSeries, "/admin/series?filter=pending", true)}
        {stat("Pending episodes", pendingEps, "/admin/series", true)}
        {stat("Dead sources", deadSources, undefined, true)}
      </div>

      <Link
        href="/admin/series/new"
        className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold"
      >
        + New series
      </Link>
    </div>
  );
}
