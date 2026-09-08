import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma, db } from "@/lib/db";
import {
  updateSeries,
  createEpisode,
  createSource,
  setSourceStatus,
  deleteSource,
  setSeriesPublish,
  deleteSeries,
  deleteEpisode,
  setPublish,
} from "@/lib/actions";
import { repullSeries } from "@/lib/metadata-actions";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  Card,
  SectionTitle,
  PublishBadge,
  SourceBadge,
  Badge,
  Field,
  inputCls,
  btnCls,
  LinkButton,
  EmptyState,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const HOSTS = [
  "STREAMTAPE", "DOODSTREAM", "MIXDROP", "VOE", "STREAMWISH", "FILEMOON",
  "MP4UPLOAD", "VIDGUARD", "LULUSTREAM", "BIGWARP", "YOURUPLOAD", "OTHER",
];
const QUALITIES = ["UNKNOWN", "Q480", "Q720", "Q1080", "Q2160", "Q360"];

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await db(() =>
    prisma.series.findUnique({
      where: { id },
      include: {
        studio: true,
        tags: true,
        episodes: {
          orderBy: [{ number: "asc" }, { part: "asc" }],
          include: { sources: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
        },
      },
    }),
  );
  if (!series) notFound();

  const flagged = series.contentWarnings.includes("possible-minor");
  const withVideo = series.episodes.filter((e) => e.sources.length > 0).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/series" className="text-sm text-white/40 hover:text-white">
          ← Series
        </Link>
        <h1 className="text-lg font-bold text-white">{series.title}</h1>
        <PublishBadge status={series.publish} />
        {series.metadataSource && <Badge tone="violet">{series.metadataSource}</Badge>}
        <LinkButton
          href={`/hentai/${series.slug}`}
          variant="ghost"
          size="sm"
          external
        >
          view ↗
        </LinkButton>
      </div>

      {flagged && (
        <Card className="mb-4 border-accent/40 bg-accent/5 p-3 text-sm text-accent">
          ⚑ Flagged <strong>possible-minor</strong>. Held from auto-publish. Confirm
          the content is legal before publishing, or reject it.
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {series.publish !== "PUBLISHED" && (
          <form action={setSeriesPublish.bind(null, id, "PUBLISHED")}>
            <SubmitButton variant="primary" size="sm" pendingText="…">
              Publish series
            </SubmitButton>
          </form>
        )}
        {series.publish === "PUBLISHED" && (
          <form action={setSeriesPublish.bind(null, id, "HIDDEN")}>
            <SubmitButton variant="secondary" size="sm" pendingText="…">
              Unpublish
            </SubmitButton>
          </form>
        )}
        {series.publish !== "REJECTED" && (
          <form action={setSeriesPublish.bind(null, id, "REJECTED")}>
            <SubmitButton variant="danger" size="sm" pendingText="…">
              Reject
            </SubmitButton>
          </form>
        )}
        {series.malId && (
          <form action={repullSeries.bind(null, id)}>
            <SubmitButton variant="ghost" size="sm" pendingText="Pulling…">
              ↻ re-pull MAL #{series.malId}
            </SubmitButton>
          </form>
        )}
        <span className="ml-auto text-xs text-white/35">
          {series.episodes.length} episodes · {withVideo} with video
        </span>
      </div>

      <SeriesForm
        action={updateSeries.bind(null, id)}
        series={series}
        submitLabel="Save series"
      />

      {/* ─────────────── episodes ─────────────── */}
      <div className="mt-8">
        <SectionTitle
          right={
            <span className="text-xs font-normal normal-case text-white/35">
              add or update an episode
            </span>
          }
        >
          Episodes
        </SectionTitle>

        <Card className="mb-4 p-3">
          <form
            action={createEpisode.bind(null, id)}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label="No." className="w-16">
              <input name="number" type="number" step="0.5" required className={inputCls} />
            </Field>
            <Field label="Part" className="w-14">
              <input name="part" type="number" defaultValue={1} className={inputCls} />
            </Field>
            <Field label="Title (optional)" className="min-w-[180px] flex-1">
              <input name="title" className={inputCls} />
            </Field>
            <Field label="Runtime s" className="w-20">
              <input name="runtimeSec" type="number" className={inputCls} />
            </Field>
            <SubmitButton variant="primary" pendingText="…">
              Add / update
            </SubmitButton>
          </form>
        </Card>

        {series.episodes.length === 0 ? (
          <EmptyState
            title="No episodes yet"
            hint="MAL-imported series get episode stubs automatically. Add one above, or the scraper will."
          />
        ) : (
          <div className="grid gap-2">
            {series.episodes.map((ep) => {
              const active = ep.sources.filter((s) => s.status === "ACTIVE").length;
              return (
                <details
                  key={ep.id}
                  className="group rounded-xl border border-white/10 bg-surface"
                  open={ep.sources.length > 0}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold text-white/80">
                      EP {ep.number}
                      {ep.part > 1 && <span className="text-white/40">·{ep.part}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/55">
                      {ep.title || <span className="text-white/25">untitled</span>}
                    </span>
                    <span className="shrink-0 text-xs text-white/35">
                      {active}/{ep.sources.length} src
                    </span>
                    <PublishBadge status={ep.publish} />
                  </summary>

                  <div className="space-y-3 border-t border-white/8 px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ep.publish !== "PUBLISHED" ? (
                        <form action={setPublish.bind(null, "episode", ep.id, "PUBLISHED")}>
                          <SubmitButton variant="secondary" size="sm" pendingText="…">
                            Publish episode
                          </SubmitButton>
                        </form>
                      ) : (
                        <form action={setPublish.bind(null, "episode", ep.id, "DRAFT")}>
                          <SubmitButton variant="ghost" size="sm" pendingText="…">
                            Unpublish
                          </SubmitButton>
                        </form>
                      )}
                      <form action={deleteEpisode.bind(null, ep.id)}>
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          confirm={`Delete EP ${ep.number} and its ${ep.sources.length} source(s)?`}
                          pendingText="…"
                        >
                          Delete
                        </SubmitButton>
                      </form>
                    </div>

                    {ep.sources.length > 0 && (
                      <div className="grid gap-1.5">
                        {ep.sources.map((src) => (
                          <div
                            key={src.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-bg px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-white/80">
                              {src.host === "OTHER" ? src.hostName || "OTHER" : src.host}
                            </span>
                            <span className="text-white/40">
                              {src.kind} · {src.language} ·{" "}
                              {src.quality === "UNKNOWN" ? "?" : src.quality.slice(1) + "p"}
                            </span>
                            <a
                              href={src.embedUrl}
                              target="_blank"
                              rel="noopener"
                              className="min-w-0 flex-1 truncate text-white/30 hover:text-white/60"
                            >
                              {src.embedUrl}
                            </a>
                            <SourceBadge status={src.status} />
                            <form
                              action={setSourceStatus.bind(
                                null,
                                src.id,
                                src.status === "ACTIVE" ? "DEAD" : "ACTIVE",
                              )}
                            >
                              <button className={btnCls("ghost", "sm")}>
                                {src.status === "ACTIVE" ? "mark dead" : "revive"}
                              </button>
                            </form>
                            <form action={deleteSource.bind(null, src.id)}>
                              <button className={btnCls("ghost", "sm")}>✕</button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      action={createSource.bind(null, ep.id)}
                      className="flex flex-wrap items-end gap-2 border-t border-white/8 pt-3"
                    >
                      <Field label="Host" className="w-32">
                        <select name="host" className={inputCls}>
                          {HOSTS.map((h) => (
                            <option key={h}>{h}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Embed URL" className="min-w-[220px] flex-1">
                        <input
                          name="embedUrl"
                          required
                          placeholder="https://streamtape.com/e/…"
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Kind" className="w-20">
                        <select name="kind" defaultValue="SUB" className={inputCls}>
                          <option>SUB</option>
                          <option>DUB</option>
                          <option>RAW</option>
                        </select>
                      </Field>
                      <Field label="Lang" className="w-16">
                        <input name="language" defaultValue="en" className={inputCls} />
                      </Field>
                      <Field label="Quality" className="w-24">
                        <select name="quality" defaultValue="UNKNOWN" className={inputCls}>
                          {QUALITIES.map((q) => (
                            <option key={q} value={q}>
                              {q === "UNKNOWN" ? "—" : q.slice(1) + "p"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <SubmitButton variant="primary" size="sm" pendingText="…">
                        Add source
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────── danger ─────────────── */}
      <Card className="mt-8 border-rose-500/25 p-4">
        <SectionTitle>Danger zone</SectionTitle>
        <form action={deleteSeries.bind(null, id)}>
          <SubmitButton
            variant="danger"
            size="sm"
            confirm={`Permanently delete "${series.title}", its ${series.episodes.length} episodes and all sources? This cannot be undone.`}
            pendingText="Deleting…"
          >
            Delete series
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
