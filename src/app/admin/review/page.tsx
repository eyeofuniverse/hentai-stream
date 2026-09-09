import Link from "next/link";
import { prisma, db } from "@/lib/db";
import {
  reviewFlag,
  setSeriesPublish,
  approveTorrentEpisode,
  rejectTorrentEpisode,
} from "@/lib/actions";
import { confirmAutoPublish } from "@/lib/scraper-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { HlsPreview } from "@/components/admin/HlsPreview";
import {
  PageHeader,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  LinkButton,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function ReviewQueue() {
  const [flagged, autoPub, torrentEps] = await db(() =>
    Promise.all([
      prisma.series.findMany({
        where: {
          contentWarnings: { has: "possible-minor" },
          publish: { not: "REJECTED" },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          synopsis: true,
          year: true,
          publish: true,
          createdAt: true,
          malId: true,
        },
      }),
      prisma.series.findMany({
        where: { autoPublishedAt: { not: null }, reviewedAt: null, publish: "PUBLISHED" },
        orderBy: { autoPublishedAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          slug: true,
          year: true,
          autoPublishedAt: true,
          _count: { select: { episodes: { where: { publish: "PUBLISHED" } } } },
        },
      }),
      prisma.episode.findMany({
        where: { needsReview: true },
        orderBy: [{ seriesId: "asc" }, { number: "asc" }],
        take: 200,
        select: {
          id: true,
          number: true,
          bunnyStatus: true,
          bunnyGuid: true,
          series: { select: { title: true, id: true, year: true } },
        },
      }),
    ]),
  );

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle="Content flagged for a look, and series the scraper auto-published for a spot-check."
      />

      <SectionTitle>
        Torrent grabs — spot check{torrentEps.length > 0 ? ` (${torrentEps.length})` : ""}
      </SectionTitle>
      {torrentEps.length === 0 ? (
        <EmptyState title="No torrent-grabbed episodes waiting." />
      ) : (
        <div className="mb-8 grid gap-2">
          {torrentEps.map((e) => (
            <Card key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge tone="violet">torrent</Badge>
              <Link
                href={`/admin/series/${e.series.id}`}
                className="min-w-0 flex-1 truncate font-medium text-white/85 hover:text-accent"
              >
                {e.series.title} · EP {e.number}
              </Link>
              <span className="text-xs text-white/35">
                {e.series.year ?? "—"} · bunny {e.bunnyStatus ?? "?"}
              </span>
              {e.bunnyGuid && (
                <HlsPreview guid={e.bunnyGuid} ready={e.bunnyStatus === "ready"} />
              )}
              <div className="flex gap-1.5">
                <form action={approveTorrentEpisode.bind(null, e.id)}>
                  <SubmitButton
                    variant="secondary"
                    size="sm"
                    pendingText="…"
                    disabled={e.bunnyStatus !== "ready"}
                  >
                    Approve &amp; publish
                  </SubmitButton>
                </form>
                <form action={rejectTorrentEpisode.bind(null, e.id)}>
                  <SubmitButton
                    variant="danger"
                    size="sm"
                    confirm={`Bin the torrent grab for ${e.series.title} EP ${e.number}?`}
                    pendingText="…"
                  >
                    Reject
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>
        Auto-published — spot check{autoPub.length > 0 ? ` (${autoPub.length})` : ""}
      </SectionTitle>
      {autoPub.length === 0 ? (
        <EmptyState title="Nothing to spot-check." hint="Scraper auto-publishes land here." />
      ) : (
        <div className="mb-8 grid gap-2">
          {autoPub.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge tone="green">auto-published</Badge>
              <Link
                href={`/admin/series/${s.id}`}
                className="min-w-0 flex-1 truncate font-medium text-white/85 hover:text-accent"
              >
                {s.title}
              </Link>
              <span className="text-xs text-white/35">
                {s.year ?? "—"} · {s._count.episodes} live ep ·{" "}
                {s.autoPublishedAt ? timeAgo(s.autoPublishedAt) : ""}
              </span>
              <div className="flex gap-1.5">
                <form action={confirmAutoPublish.bind(null, s.id)}>
                  <SubmitButton variant="secondary" size="sm" pendingText="…">
                    Looks good
                  </SubmitButton>
                </form>
                <form action={setSeriesPublish.bind(null, s.id, "HIDDEN")}>
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Unpublish
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>
        Possible-minor flags{flagged.length > 0 ? ` (${flagged.length})` : ""}
      </SectionTitle>

      {flagged.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          hint="Nothing is currently flagged for review."
        />
      ) : (
        <div className="grid gap-3">
          {flagged.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="pink">⚑ possible-minor</Badge>
                <Link
                  href={`/admin/series/${s.id}`}
                  className="font-semibold text-white hover:text-accent"
                >
                  {s.title}
                </Link>
                {s.year && <span className="text-xs text-white/35">{s.year}</span>}
                {s.malId && <Badge tone="violet">MAL #{s.malId}</Badge>}
                <span className="ml-auto text-xs text-white/30">
                  imported {timeAgo(s.createdAt)}
                </span>
              </div>

              {s.synopsis && (
                <p className="mb-3 line-clamp-3 text-sm text-white/55">{s.synopsis}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <form action={reviewFlag.bind(null, s.id, "clear")}>
                  <SubmitButton
                    variant="secondary"
                    size="sm"
                    confirm={`Clear the flag on "${s.title}"? It stays DRAFT — you still publish it manually once it has video.`}
                    pendingText="…"
                  >
                    Clear flag
                  </SubmitButton>
                </form>
                <form action={reviewFlag.bind(null, s.id, "reject")}>
                  <SubmitButton
                    variant="danger"
                    size="sm"
                    confirm={`Reject "${s.title}"? It will be hidden permanently.`}
                    pendingText="…"
                  >
                    Reject
                  </SubmitButton>
                </form>
                <LinkButton href={`/admin/series/${s.id}`} variant="ghost" size="sm">
                  Open editor →
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
