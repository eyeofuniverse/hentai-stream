import Link from "next/link";
import { prisma, db } from "@/lib/db";
import {
  Card,
  PageHeader,
  Stat,
  SectionTitle,
  Badge,
  LinkButton,
  timeAgo,
} from "@/components/console/ui";
import { runMetadataSync } from "@/lib/metadata-actions";
import { SubmitButton } from "@/components/console/SubmitButton";

type SyncLog = {
  at?: string;
  created?: number;
  updated?: number;
  flagged?: number;
  episodeStubs?: number;
  seasons?: number;
  tookMs?: number;
};

export default async function AdminHome() {
  const [
    series,
    published,
    draft,
    episodes,
    epsWithSource,
    sources,
    activeSources,
    deadSources,
    pendingSeries,
    pendingEps,
    openReports,
    flagged,
    fromMal,
    recentSeries,
    recentSources,
    syncRow,
  ] = await db(() =>
    Promise.all([
      prisma.series.count(),
      prisma.series.count({ where: { publish: "PUBLISHED" } }),
      prisma.series.count({ where: { publish: "DRAFT" } }),
      prisma.episode.count(),
      prisma.episode.count({ where: { sources: { some: {} } } }),
      prisma.videoSource.count(),
      prisma.videoSource.count({ where: { status: "ACTIVE" } }),
      prisma.videoSource.count({ where: { status: "DEAD" } }),
      prisma.series.count({ where: { publish: "PENDING" } }),
      prisma.episode.count({ where: { publish: "PENDING" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.series.count({
        where: { contentWarnings: { has: "possible-minor" }, publish: { not: "REJECTED" } },
      }),
      prisma.series.count({ where: { metadataSource: "mal" } }),
      prisma.series.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, publish: true, createdAt: true, metadataSource: true },
      }),
      prisma.videoSource.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          host: true,
          createdAt: true,
          episode: { select: { number: true, seriesId: true, series: { select: { title: true } } } },
        },
      }),
      prisma.setting.findUnique({ where: { key: "metadataSync" } }),
    ]),
  );

  const [spotCheck, unmatched, zeroSearch, scrapeRuns, enrichRuns] = await db(() =>
    Promise.all([
      prisma.series.count({
        where: { autoPublishedAt: { not: null }, reviewedAt: null, publish: "PUBLISHED" },
      }),
      prisma.unmatchedTitle.count({ where: { status: "PENDING" } }),
      prisma.searchTermStat.count({ where: { lastResultCount: 0 } }),
      prisma.scrapeRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          site: true,
          mode: true,
          startedAt: true,
          finishedAt: true,
          ok: true,
          matched: true,
          sourcesAdded: true,
          unmatched: true,
        },
      }),
      prisma.enrichRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          source: true,
          startedAt: true,
          finishedAt: true,
          ok: true,
          seriesMatched: true,
          tagsAdded: true,
          fieldsFilled: true,
        },
      }),
    ]),
  ).catch(() => [0, 0, 0, [] as never[], [] as never[]] as const);

  const hosting = await db(() =>
    prisma.episode.groupBy({ by: ["bunnyStatus"], _count: true }),
  ).catch(() => [] as { bunnyStatus: string | null; _count: number }[]);
  const hostBy = Object.fromEntries(
    hosting.map((h) => [h.bunnyStatus ?? "none", h._count]),
  );

  const sync = (syncRow?.value ?? null) as SyncLog | null;
  const attention = [
    { label: "Auto-published — spot check", value: spotCheck, href: "/console/review" },
    { label: "Unmatched scraped titles", value: unmatched, href: "/console/unmatched" },
    { label: "Searches with no results", value: zeroSearch, href: "/console/search" },
    { label: "Series pending review", value: pendingSeries, href: "/console/series?publish=PENDING" },
    { label: "Episodes pending review", value: pendingEps, href: "/console/series?publish=PENDING" },
    { label: "Flagged: possible minor", value: flagged, href: "/console/review" },
    { label: "Open reports", value: openReports, href: "/console/reports" },
    { label: "Dead video sources", value: deadSources, href: "/console/series?sources=dead" },
  ].filter((a) => a.value > 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Catalogue health and everything waiting on you."
        actions={
          <>
            <LinkButton href="/console/series/new" variant="primary">
              + New series
            </LinkButton>
            <form action={runMetadataSync}>
              <SubmitButton variant="secondary" pendingText="Syncing…">
                Run metadata sync
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Series" value={series} href="/console/series" />
        <Stat label="Published" value={published} href="/console/series?publish=PUBLISHED" tone="good" />
        <Stat label="Draft (metadata only)" value={draft} href="/console/series?publish=DRAFT" />
        <Stat label="From MyAnimeList" value={fromMal} />
        <Stat label="Episodes" value={episodes} />
        <Stat label="Episodes with a video" value={epsWithSource} tone="good" />
        <Stat label="Video sources" value={sources} />
        <Stat label="Hosted on Bunny" value={hostBy.ready ?? 0} tone="good" />
        <Stat
          label="Hosting: processing / failed"
          value={`${(hostBy.queued ?? 0) + (hostBy.fetching ?? 0) + (hostBy.processing ?? 0)} / ${hostBy.failed ?? 0}`}
        />
      </div>

      {attention.length > 0 && (
        <Card className="mt-6 p-4">
          <SectionTitle>Needs attention</SectionTitle>
          <div className="grid gap-1.5">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <span>{a.label}</span>
                <Badge tone={a.label.includes("minor") ? "pink" : a.label.includes("report") ? "red" : "amber"}>
                  {a.value}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle right={<Link href="/console/metadata" className="text-xs text-white/40 hover:text-white">details →</Link>}>
            Metadata sync
          </SectionTitle>
          {sync ? (
            <div className="text-sm text-white/70">
              <p>
                <span className="text-emerald-300">+{sync.created ?? 0} new</span> ·{" "}
                {sync.updated ?? 0} updated · {sync.episodeStubs ?? 0} episode stubs ·{" "}
                <span className={sync.flagged ? "text-accent" : ""}>{sync.flagged ?? 0} flagged</span>
              </p>
              <p className="mt-1 text-xs text-white/35">
                {sync.seasons ?? 0} seasons · {((sync.tookMs ?? 0) / 1000) | 0}s ·{" "}
                {sync.at ? timeAgo(sync.at) : "—"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/35">No sync has run yet.</p>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>Recently added series</SectionTitle>
          <ul className="space-y-1 text-sm">
            {recentSeries.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/console/series/${s.id}`}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-white/70 hover:text-white"
                >
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {s.metadataSource === "mal" && <Badge tone="violet">MAL</Badge>}
                  <span className="shrink-0 text-xs text-white/30">{timeAgo(s.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle
            right={
              <Link href="/console/unmatched" className="text-xs text-white/40 hover:text-white">
                unmatched →
              </Link>
            }
          >
            Scraper runs
          </SectionTitle>
          {scrapeRuns.length === 0 ? (
            <p className="text-sm text-white/35">
              No runs yet — trigger the “Scrape video sources” Action.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {scrapeRuns.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-white/70">
                  <Badge tone={r.ok ? "green" : r.finishedAt ? "red" : "amber"}>
                    {r.site}
                  </Badge>
                  <span className="text-xs text-white/45">{r.mode}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-white/40">
                    +{r.sourcesAdded} src · {r.matched} matched · {r.unmatched} new
                  </span>
                  <span className="shrink-0 text-xs text-white/30">
                    {timeAgo(r.startedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>Enrichment runs</SectionTitle>
          {enrichRuns.length === 0 ? (
            <p className="text-sm text-white/35">
              No runs yet — trigger the “Enrich metadata” Action.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {enrichRuns.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-white/70">
                  <Badge tone={r.ok ? "green" : r.finishedAt ? "red" : "amber"}>
                    {r.source}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-white/40">
                    {r.seriesMatched} matched · +{r.tagsAdded} tags · +{r.fieldsFilled} fields
                  </span>
                  <span className="shrink-0 text-xs text-white/30">
                    {timeAgo(r.startedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Recently attached video sources</SectionTitle>
          {recentSources.length === 0 ? (
            <p className="text-sm text-white/35">
              None yet — sources arrive from the admin editor or the scraper.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentSources.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-white/70">
                  <Badge tone="slate">{s.host}</Badge>
                  <Link
                    href={`/console/series/${s.episode.seriesId}`}
                    className="min-w-0 flex-1 truncate hover:text-white"
                  >
                    {s.episode.series.title} · EP {s.episode.number}
                  </Link>
                  <span className="shrink-0 text-xs text-white/30">{timeAgo(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
