import { prisma, db } from "@/lib/db";
import { setUnmatchedStatus } from "@/lib/scraper-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { MapUnmatched } from "@/components/admin/MapUnmatched";
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

export default async function UnmatchedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "PENDING" } = await searchParams;

  const [rows, counts] = await db(() =>
    Promise.all([
      prisma.unmatchedTitle.findMany({
        where: { status: status as never },
        orderBy: [{ hits: "desc" }, { lastSeenAt: "desc" }],
        take: 200,
      }),
      prisma.unmatchedTitle.groupBy({ by: ["status"], _count: true }),
    ]),
  );
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div>
      <PageHeader
        title="Unmatched titles"
        subtitle="Titles the scraper found but couldn't confidently map to a series. Map one and its name is saved as an alt-title — the next crawl ingests it automatically."
      />

      <div className="mb-4">
        <FilterTabs
          current={status}
          hrefFor={(v) => `/admin/unmatched?status=${v}`}
          options={["PENDING", "MAPPED", "IGNORED"].map((s) => ({
            value: s,
            label: s[0] + s.slice(1).toLowerCase(),
            count: countBy[s] ?? 0,
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={`No ${status.toLowerCase()} titles.`} />
      ) : (
        <div className="grid gap-2">
          {rows.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{u.site}</Badge>
                <a
                  href={u.sampleUrl}
                  target="_blank"
                  rel="noopener"
                  className="min-w-0 flex-1 truncate font-medium text-white/85 hover:text-accent"
                >
                  {u.rawTitle}
                </a>
                {u.year && <span className="text-xs text-white/35">{u.year}</span>}
                {u.episodeCount > 0 && (
                  <Badge tone="violet">{u.episodeCount} ep waiting</Badge>
                )}
                <span className="text-xs text-white/25">
                  ×{u.hits} · {timeAgo(u.lastSeenAt)}
                </span>
              </div>

              {status === "PENDING" && (
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <div className="min-w-[240px] flex-1">
                    <MapUnmatched unmatchedId={u.id} defaultQuery={u.rawTitle} />
                  </div>
                  <form action={setUnmatchedStatus.bind(null, u.id, "IGNORED")}>
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      Ignore
                    </SubmitButton>
                  </form>
                </div>
              )}
              {status === "IGNORED" && (
                <form
                  action={setUnmatchedStatus.bind(null, u.id, "PENDING")}
                  className="mt-2"
                >
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Un-ignore
                  </SubmitButton>
                </form>
              )}
              {status === "MAPPED" && u.resolvedSeriesId && (
                <a
                  href={`/admin/series/${u.resolvedSeriesId}`}
                  className="mt-1 inline-block text-xs text-white/40 hover:text-white"
                >
                  → mapped series
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
