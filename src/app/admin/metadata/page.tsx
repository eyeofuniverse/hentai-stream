import { prisma } from "@/lib/db";
import { runMetadataSync } from "@/lib/metadata-actions";

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
  errors?: string[];
  tookMs?: number;
  at?: string;
};

export default async function MetadataPage() {
  const [
    total,
    drafts,
    published,
    noSources,
    flagged,
    withMal,
    logRow,
  ] = await Promise.all([
    prisma.series.count(),
    prisma.series.count({ where: { publish: "DRAFT" } }),
    prisma.series.count({ where: { publish: "PUBLISHED" } }),
    prisma.series.count({ where: { episodes: { none: {} } } }),
    prisma.series.count({ where: { contentWarnings: { has: "possible-minor" } } }),
    prisma.series.count({ where: { malId: { not: null } } }),
    prisma.setting.findUnique({ where: { key: "metadataSync" } }),
  ]);

  const log = (logRow?.value ?? null) as SyncLog | null;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Metadata</h1>
      <p className="mb-5 text-sm text-white/50">
        Catalogue metadata is pulled from MyAnimeList. Imported titles start as{" "}
        <span className="m rounded bg-surface px-1">DRAFT</span> with no episodes —
        they go live when a mirror is attached.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Series total" value={total} />
        <Stat label="From MAL" value={withMal} />
        <Stat label="Draft (metadata only)" value={drafts} />
        <Stat label="Published" value={published} />
        <Stat label="No episodes yet" value={noSources} />
        <Stat label="Flagged: possible minor" value={flagged} alert />
      </div>

      <form action={runMetadataSync} className="mt-5">
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold">
          Run weekly sync now
        </button>
        <span className="ml-3 text-xs text-white/40">
          previous + current + next season · ~1 min
        </span>
      </form>

      {log && (
        <div className="mt-5 rounded-xl border border-white/10 bg-surface p-4 text-sm">
          <div className="mb-1 font-semibold">
            Last sync{" "}
            <span className="text-white/40">
              {log.at ? new Date(log.at).toLocaleString() : ""}
            </span>
          </div>
          <p className="text-white/70">
            {log.mode} · {log.seasons} seasons · scanned {log.scanned} ·{" "}
            <span className="text-green-400">+{log.created} new</span> ·{" "}
            {log.updated} updated · {log.skipped} kept ·{" "}
            <span className={log.flagged ? "text-accent" : ""}>
              {log.flagged} flagged
            </span>{" "}
            · {((log.tookMs ?? 0) / 1000) | 0}s
          </p>
          {log.errors && log.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-white/40">
                {log.errors.length} errors
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-white/50">
                {log.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-white/10 bg-surface p-4 text-sm text-white/70">
        <p className="mb-2 font-semibold text-white">First-time full backfill</p>
        <p className="mb-2">
          Pulls the entire hentai catalogue (~1,800 titles, ~15 min). Run once
          with the dev server up:
        </p>
        <code className="block rounded bg-black/40 p-2 text-xs">
          npm run metadata:backfill
        </code>
        <p className="mt-2 text-xs text-white/40">
          Or hit{" "}
          <span className="m">
            /api/cron/metadata?mode=range&amp;from=1985&amp;to=2027&amp;key=CRON_SECRET
          </span>
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        alert && value > 0
          ? "border-accent/50 bg-accent/10"
          : "border-white/10 bg-surface"
      }`}
    >
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
