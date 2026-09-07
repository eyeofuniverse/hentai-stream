import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  updateSeries,
  createEpisode,
  createSource,
  setSourceStatus,
  deleteSource,
} from "@/lib/actions";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { repullSeries } from "@/lib/metadata-actions";

export const dynamic = "force-dynamic";

const HOSTS = [
  "STREAMTAPE", "DOODSTREAM", "MIXDROP", "VOE", "STREAMWISH", "FILEMOON",
  "MP4UPLOAD", "VIDGUARD", "LULUSTREAM", "BIGWARP", "YOURUPLOAD", "OTHER",
];
const QUALITIES = ["UNKNOWN", "Q480", "Q720", "Q1080", "Q2160", "Q360"];
const input =
  "rounded-lg border border-white/10 bg-surface p-2 text-sm outline-none focus:border-white/25";

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      studio: true,
      tags: true,
      episodes: {
        orderBy: { number: "asc" },
        include: { sources: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!series) notFound();

  const updateAction = updateSeries.bind(null, id);
  const addEpisode = createEpisode.bind(null, id);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/admin/series" className="text-sm text-white/40">← Series</Link>
        <h1 className="text-lg font-bold">{series.title}</h1>
        {series.malId && (
          <form action={repullSeries.bind(null, id)}>
            <button className="rounded-md border border-white/15 px-2 py-1 text-xs hover:border-accent/50">
              ↻ re-pull MAL #{series.malId}
            </button>
          </form>
        )}
        <Link
          href={`/hentai/${series.slug}`}
          className="ml-auto text-xs text-white/40 hover:text-white"
        >
          view ↗
        </Link>
      </div>

      <SeriesForm action={updateAction} series={series} submitLabel="Save series" />

      <hr className="my-8 border-white/10" />
      <h2 className="mb-3 text-base font-bold">Episodes</h2>

      <form action={addEpisode} className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-white/50">
          Number
          <input name="number" type="number" step="0.5" required className={`${input} w-20`} />
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Part
          <input name="part" type="number" defaultValue={1} className={`${input} w-16`} />
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Title (optional)
          <input name="title" className={`${input} w-52`} />
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Runtime (s)
          <input name="runtimeSec" type="number" className={`${input} w-24`} />
        </label>
        <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold">Add / update</button>
      </form>

      <div className="grid gap-3">
        {series.episodes.map((ep) => (
          <details key={ep.id} className="rounded-lg border border-white/8 bg-surface">
            <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
              <span className="font-semibold">EP {ep.number}</span>
              <span className="min-w-0 flex-1 truncate text-white/60">{ep.title}</span>
              <span className="text-xs text-white/40">{ep.sources.length} src</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  ep.publish === "PUBLISHED" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"
                }`}
              >
                {ep.publish}
              </span>
            </summary>

            <div className="border-t border-white/8 px-3 py-3">
              <div className="grid gap-1.5">
                {ep.sources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center gap-2 rounded bg-bg px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium">{src.host}</span>
                    <span className="text-white/40">
                      {src.kind} {src.language} {src.quality}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/30">{src.embedUrl}</span>
                    <span
                      className={
                        src.status === "ACTIVE" ? "text-green-400" : "text-white/40"
                      }
                    >
                      {src.status}
                    </span>
                    <form action={setSourceStatus.bind(null, src.id, src.status === "ACTIVE" ? "DEAD" : "ACTIVE")}>
                      <button className="rounded border border-white/15 px-1.5 py-0.5">
                        {src.status === "ACTIVE" ? "mark dead" : "revive"}
                      </button>
                    </form>
                    <form action={deleteSource.bind(null, src.id)}>
                      <button className="rounded border border-white/15 px-1.5 py-0.5 text-accent">×</button>
                    </form>
                  </div>
                ))}
              </div>

              <form
                action={createSource.bind(null, ep.id)}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <select name="host" className={input}>
                  {HOSTS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
                <input
                  name="embedUrl"
                  required
                  placeholder="https://streamtape.com/e/…"
                  className={`${input} min-w-[240px] flex-1`}
                />
                <select name="kind" className={input} defaultValue="SUB">
                  <option>SUB</option>
                  <option>DUB</option>
                  <option>RAW</option>
                </select>
                <input name="language" defaultValue="en" className={`${input} w-16`} />
                <select name="quality" className={input} defaultValue="UNKNOWN">
                  {QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {q === "UNKNOWN" ? "—" : q.slice(1) + "p"}
                    </option>
                  ))}
                </select>
                <input name="label" placeholder="label" className={`${input} w-20`} />
                <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold">
                  Add source
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
