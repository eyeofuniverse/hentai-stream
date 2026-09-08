import { prisma, db } from "@/lib/db";
import { runMetadataSync } from "@/lib/metadata-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  PageHeader,
  Card,
  Stat,
  SectionTitle,
  Badge,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

type SyncLog = {
  mode?: string;
  seasons?: number;
  scanned?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  flagged?: number;
  episodeStubs?: number;
  errors?: string[];
  errorCount?: number;
  tookMs?: number;
  at?: string;
};

export default async function MetadataPage() {
  const [total, fromMal, draft, published, flagged, episodeStubs, noEpisodes, logRow] =
    await db(() =>
      Promise.all([
        prisma.series.count(),
        prisma.series.count({ where: { metadataSource: "mal" } }),
        prisma.series.count({ where: { publish: "DRAFT" } }),
        prisma.series.count({ where: { publish: "PUBLISHED" } }),
        prisma.series.count({ where: { contentWarnings: { has: "possible-minor" } } }),
        prisma.episode.count({ where: { publish: "DRAFT", sources: { none: {} } } }),
        prisma.series.count({ where: { episodes: { none: {} } } }),
        prisma.setting.findUnique({ where: { key: "metadataSync" } }),
      ]),
    );

  const log = (logRow?.value ?? null) as SyncLog | null;

  return (
    <div>
      <PageHeader
        title="Metadata"
        subtitle="The catalogue is populated from the MyAnimeList API. Imported titles start DRAFT with empty episode skeletons — they go live once the scraper attaches a video."
        actions={
          <form action={runMetadataSync}>
            <SubmitButton variant="primary" pendingText="Syncing…">
              Run weekly sync now
            </SubmitButton>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Series total" value={total} />
        <Stat label="From MyAnimeList" value={fromMal} />
        <Stat label="Draft (metadata only)" value={draft} />
        <Stat label="Published" value={published} tone="good" />
        <Stat label="Episode stubs awaiting video" value={episodeStubs} />
        <Stat label="Series with no episodes" value={noEpisodes} />
        <Stat label="Flagged: possible minor" value={flagged} tone="warn" href="/admin/review" />
      </div>

      {log && (
        <Card className="mt-6 p-4">
          <SectionTitle
            right={
              <span className="text-xs font-normal normal-case text-white/35">
                {log.at ? timeAgo(log.at) : ""}
              </span>
            }
          >
            Last sync
          </SectionTitle>
          <p className="text-sm text-white/75">
            {log.mode} · {log.seasons ?? 0} seasons · scanned {log.scanned ?? 0} ·{" "}
            <span className="text-emerald-300">+{log.created ?? 0} new</span> ·{" "}
            {log.updated ?? 0} updated · {log.skipped ?? 0} kept ·{" "}
            {log.episodeStubs ?? 0} episode stubs ·{" "}
            <span className={log.flagged ? "text-accent" : ""}>{log.flagged ?? 0} flagged</span>{" "}
            · {((log.tookMs ?? 0) / 1000) | 0}s
          </p>
          {log.errors && log.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-white/40">
                {log.errorCount ?? log.errors.length} errors
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-white/45">
                {log.errors.map((e, i) => (
                  <li key={i} className="break-all">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      <Card className="mt-6 p-4 text-sm text-white/70">
        <SectionTitle>Full catalogue backfill</SectionTitle>
        <p className="mb-3">
          One-off import of the entire hentai catalogue (~1,800 titles + episode
          skeletons). Runs on a US GitHub runner in ~15–30 min, fully unattended
          and resumable.
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-white/60">
          <li>
            Repo → <Badge>Actions</Badge> → <em>“Backfill catalogue (one-off)”</em>{" "}
            → <em>Run workflow</em>
          </li>
          <li>Needs repo secrets: DATABASE_URL, DIRECT_URL, MAL_CLIENT_ID</li>
        </ol>
        <p className="mt-3 text-xs text-white/35">
          Or locally: <code className="rounded bg-black/40 px-1 py-0.5">npm run metadata:backfill</code>
        </p>
      </Card>
    </div>
  );
}
