import Link from "next/link";
import { prisma } from "@/lib/db";
import { resolveReport } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "OPEN" } = await searchParams;
  const reports = await prisma.report.findMany({
    where: { status: status as never },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // hydrate target titles
  const withTargets = await Promise.all(
    reports.map(async (r) => {
      let label = r.targetId;
      let href = "#";
      if (r.targetType === "series") {
        const s = await prisma.series.findUnique({ where: { id: r.targetId } });
        if (s) {
          label = s.title;
          href = `/admin/series/${s.id}`;
        }
      } else if (r.targetType === "episode") {
        const e = await prisma.episode.findUnique({
          where: { id: r.targetId },
          include: { series: true },
        });
        if (e) {
          label = `${e.series.title} EP ${e.number}`;
          href = `/admin/series/${e.seriesId}`;
        }
      }
      return { ...r, label, href };
    }),
  );

  return (
    <div>
      <div className="mb-4 flex gap-2 text-sm">
        {["OPEN", "RESOLVED", "DISMISSED"].map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-lg px-3 py-1.5 ${
              status === s ? "bg-accent font-semibold" : "bg-surface text-white/60"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {withTargets.length === 0 ? (
        <p className="text-sm text-white/40">Nothing here.</p>
      ) : (
        <div className="grid gap-2">
          {withTargets.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-surface px-3 py-2.5 text-sm"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  r.reason === "UNDERAGE"
                    ? "bg-accent text-white"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {r.reason}
              </span>
              <Link href={r.href} className="min-w-0 flex-1 truncate hover:text-accent">
                {r.label}
              </Link>
              <span className="text-xs text-white/30">
                {r.targetType} · {new Date(r.createdAt).toLocaleDateString()}
              </span>
              {r.details && <p className="w-full text-xs text-white/50">“{r.details}”</p>}
              {r.status === "OPEN" && (
                <div className="flex gap-1.5">
                  <form action={resolveReport.bind(null, r.id, "RESOLVED")}>
                    <button className="rounded border border-white/15 px-2 py-1 text-xs">
                      Resolve
                    </button>
                  </form>
                  <form action={resolveReport.bind(null, r.id, "DISMISSED")}>
                    <button className="rounded border border-white/15 px-2 py-1 text-xs text-white/50">
                      Dismiss
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
