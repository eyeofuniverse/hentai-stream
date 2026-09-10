import { Prisma } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { setUnmatchedStatus } from "@/lib/scraper-actions";
import { SubmitButton } from "@/components/console/SubmitButton";
import { MapUnmatched, type Suggestion } from "@/components/console/MapUnmatched";
import {
  PageHeader,
  Card,
  Badge,
  FilterTabs,
  EmptyState,
  timeAgo,
} from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** Strip trailing "episode N" / "part N" / a year so the trigram match keys on
 *  the series name, not the episode marker. */
function matchKey(raw: string): string {
  return raw
    .replace(/\b(episode|ep|part|pt|season|s)\s*\d+\b/gi, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

type SugRow = {
  uid: string;
  id: string;
  title: string;
  year: number | null;
  eps: number;
  score: number;
};

async function suggestionsFor(
  rows: { id: string; rawTitle: string }[],
): Promise<Map<string, Suggestion[]>> {
  const out = new Map<string, Suggestion[]>();
  if (rows.length === 0) return out;

  const values = Prisma.join(
    rows.map((r) => Prisma.sql`(${r.id}, ${matchKey(r.rawTitle)})`),
  );

  const hits = await db(() =>
    prisma.$queryRaw<SugRow[]>(Prisma.sql`
      SELECT u.uid, s.id, s.title, s.year, s.eps, s.score
      FROM (VALUES ${values}) AS u(uid, q)
      CROSS JOIN LATERAL (
        SELECT x.id, x.title, x.year,
          (SELECT count(*)::int FROM "Episode" e WHERE e."seriesId" = x.id) AS eps,
          GREATEST(
            similarity(x.title, u.q),
            similarity(coalesce(x."titleEnglish", ''), u.q),
            similarity(coalesce(x."titleRomaji", ''), u.q)
          ) AS score
        FROM "Series" x
        WHERE x.title % u.q
           OR x."titleEnglish" % u.q
           OR x."titleRomaji" % u.q
        ORDER BY score DESC
        LIMIT 3
      ) s
      ORDER BY u.uid, s.score DESC
    `),
  ).catch(() => [] as SugRow[]);

  for (const h of hits) {
    const list = out.get(h.uid) ?? [];
    list.push({ id: h.id, title: h.title, year: h.year, eps: h.eps, score: h.score });
    out.set(h.uid, list);
  }
  return out;
}

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

  const suggestions =
    status === "PENDING"
      ? await suggestionsFor(rows.map((r) => ({ id: r.id, rawTitle: r.rawTitle })))
      : new Map<string, Suggestion[]>();

  return (
    <div>
      <PageHeader
        title="Unmatched titles"
        subtitle="Videos the scraper found but couldn't confidently map to a series. Pick the right series — its name is saved as an alt-title and the next crawl ingests the episodes automatically."
      />

      <div className="mb-4">
        <FilterTabs
          current={status}
          hrefFor={(v) => `/console/unmatched?status=${v}`}
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
                  <div className="min-w-[260px] flex-1">
                    <MapUnmatched
                      unmatchedId={u.id}
                      defaultQuery={u.rawTitle}
                      suggestions={suggestions.get(u.id) ?? []}
                    />
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
                  href={`/console/series/${u.resolvedSeriesId}`}
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
