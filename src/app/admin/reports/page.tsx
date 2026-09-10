import Link from "next/link";
import { prisma, db } from "@/lib/db";
import { resolveReport } from "@/lib/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  PageHeader,
  Card,
  Badge,
  FilterTabs,
  EmptyState,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const REASON_TONE: Record<string, string> = {
  UNDERAGE: "pink",
  NON_CONSENSUAL: "pink",
  COPYRIGHT: "amber",
  BROKEN_LINK: "slate",
  WRONG_CONTENT: "amber",
  SPAM: "slate",
  ABUSE: "red",
  OTHER: "slate",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = ["OPEN", "RESOLVED", "DISMISSED"].includes(sp.status ?? "")
    ? sp.status!
    : "OPEN";

  const [reports, counts] = await db(() =>
    Promise.all([
      prisma.report.findMany({
        where: { status: status as never },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.report.groupBy({ by: ["status"], _count: true }),
    ]),
  );
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  const withTargets = await db(() =>
    Promise.all(
      reports.map(async (r) => {
        let label = r.targetId;
        let href = "#";
        if (r.targetType === "series") {
          const s = await prisma.series.findUnique({
            where: { id: r.targetId },
            select: { id: true, title: true },
          });
          if (s) {
            label = s.title;
            href = `/admin/series/${s.id}`;
          }
        } else if (r.targetType === "episode") {
          const e = await prisma.episode.findUnique({
            where: { id: r.targetId },
            select: { number: true, seriesId: true, series: { select: { title: true } } },
          });
          if (e) {
            label = `${e.series.title} · EP ${e.number}`;
            href = `/admin/series/${e.seriesId}`;
          }
        }
        return { ...r, label, href };
      }),
    ),
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="User-submitted reports on series, episodes and broken links."
      />

      <div className="mb-4">
        <FilterTabs
          current={status}
          hrefFor={(v) => `/admin/reports?status=${v}`}
          options={["OPEN", "RESOLVED", "DISMISSED"].map((s) => ({
            value: s,
            label: s[0] + s.slice(1).toLowerCase(),
            count: countBy[s] ?? 0,
          }))}
        />
      </div>

      {withTargets.length === 0 ? (
        <EmptyState title={`No ${status.toLowerCase()} reports.`} />
      ) : (
        <div className="grid gap-2">
          {withTargets.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge tone={REASON_TONE[r.reason] ?? "slate"}>
                {r.reason.replace("_", " ")}
              </Badge>
              <Link href={r.href} className="min-w-0 flex-1 truncate font-medium text-white/85 hover:text-accent">
                {r.label}
              </Link>
              <span className="text-xs text-white/30">
                {r.targetType} · {timeAgo(r.createdAt)}
              </span>
              {r.details && (
                <p className="w-full rounded bg-white/[0.03] px-2 py-1.5 text-xs text-white/55">
                  “{r.details}”
                </p>
              )}
              {r.status === "OPEN" && (
                <div className="flex w-full gap-1.5 sm:w-auto">
                  <form action={resolveReport.bind(null, r.id, "RESOLVED")}>
                    <SubmitButton variant="secondary" size="sm" pendingText="…">
                      Resolve
                    </SubmitButton>
                  </form>
                  <form action={resolveReport.bind(null, r.id, "DISMISSED")}>
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      Dismiss
                    </SubmitButton>
                  </form>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
