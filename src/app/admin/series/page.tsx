import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { cover } from "@/lib/cloudinary";
import {
  PageHeader,
  LinkButton,
  PublishBadge,
  Badge,
  FilterTabs,
  Pagination,
  EmptyState,
  inputCls,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PER = 50;
const PUBLISH = ["ALL", "DRAFT", "PENDING", "PUBLISHED", "HIDDEN", "REJECTED"];

type SP = {
  q?: string;
  publish?: string;
  source?: string;
  episodes?: string;
  flagged?: string;
  page?: string;
};

export default async function AdminSeriesList({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const publishParam = (sp.publish ?? "ALL").toUpperCase();
  const publish = PUBLISH.includes(publishParam) ? publishParam : "ALL";

  const where: Prisma.SeriesWhereInput = {
    ...(publish !== "ALL" ? { publish: publish as Prisma.EnumPublishStatusFilter["equals"] } : {}),
    ...(sp.source === "mal" ? { metadataSource: "mal" } : {}),
    ...(sp.source === "manual" ? { metadataSource: { not: "mal" } } : {}),
    ...(sp.source === "dead" ? { episodes: { some: { sources: { some: { status: "DEAD" } } } } } : {}),
    ...(sp.episodes === "none" ? { episodes: { none: {} } } : {}),
    ...(sp.episodes === "novideo" ? { episodes: { none: { sources: { some: {} } } } } : {}),
    ...(sp.episodes === "hasvideo" ? { episodes: { some: { sources: { some: {} } } } } : {}),
    ...(sp.flagged === "1" ? { contentWarnings: { has: "possible-minor" } } : {}),
    ...(sp.q
      ? {
          OR: [
            { title: { contains: sp.q, mode: "insensitive" } },
            { titleEnglish: { contains: sp.q, mode: "insensitive" } },
            { titleRomaji: { contains: sp.q, mode: "insensitive" } },
            { altTitles: { has: sp.q } },
          ],
        }
      : {}),
  };

  const [rows, total, counts] = await db(() =>
    Promise.all([
      prisma.series.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PER,
        take: PER,
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          type: true,
          year: true,
          publish: true,
          totalEpisodes: true,
          metadataSource: true,
          contentWarnings: true,
          updatedAt: true,
          _count: { select: { episodes: true } },
          episodes: { where: { sources: { some: {} } }, select: { id: true } },
        },
      }),
      prisma.series.count({ where }),
      prisma.series.groupBy({ by: ["publish"], _count: true }),
    ]),
  );

  const countBy = Object.fromEntries(counts.map((c) => [c.publish, c._count]));
  const pages = Math.ceil(total / PER);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    p.delete("page");
    return `/admin/series?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Series"
        subtitle={`${total.toLocaleString()} matching · ${countBy.PUBLISHED ?? 0} published, ${countBy.DRAFT ?? 0} draft`}
        actions={
          <LinkButton href="/admin/series/new" variant="primary">
            + New series
          </LinkButton>
        }
      />

      <form className="mb-3">
        {(["publish", "source", "episodes", "flagged"] as const).map((k) =>
          sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null,
        )}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search all titles…"
          className={`${inputCls} max-w-sm`}
        />
      </form>

      <div className="mb-3 space-y-2">
        <FilterTabs
          current={publish}
          hrefFor={(v) => qs({ publish: v === "ALL" ? undefined : v })}
          options={PUBLISH.map((v) => ({
            value: v,
            label: v === "ALL" ? "All" : v[0] + v.slice(1).toLowerCase(),
            count: v === "ALL" ? undefined : countBy[v] ?? 0,
          }))}
        />
        <FilterTabs
          current={sp.source ?? sp.episodes ?? (sp.flagged === "1" ? "flagged" : "any")}
          hrefFor={(v) => {
            if (v === "any") return qs({ source: undefined, episodes: undefined, flagged: undefined });
            if (v === "flagged") return qs({ flagged: "1", source: undefined, episodes: undefined });
            if (["mal", "manual", "dead"].includes(v))
              return qs({ source: v, episodes: undefined, flagged: undefined });
            return qs({ episodes: v, source: undefined, flagged: undefined });
          }}
          options={[
            { value: "any", label: "Any" },
            { value: "mal", label: "From MAL" },
            { value: "manual", label: "Manual" },
            { value: "novideo", label: "No video yet" },
            { value: "hasvideo", label: "Has video" },
            { value: "none", label: "No episodes" },
            { value: "dead", label: "Dead links" },
            { value: "flagged", label: "⚑ Flagged" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No series match these filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="hidden items-center gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/35 sm:flex">
            <span className="w-8" />
            <span className="flex-1">Title</span>
            <span className="w-14">Type</span>
            <span className="w-12">Year</span>
            <span className="w-24">Episodes</span>
            <span className="w-24">Status</span>
            <span className="w-16 text-right">Updated</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {rows.map((s) => {
              const src = cover(s.coverUrl);
              const withVideo = s.episodes.length;
              const flagged = s.contentWarnings.includes("possible-minor");
              return (
                <Link
                  key={s.id}
                  href={`/admin/series/${s.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-12 w-8 shrink-0 rounded object-cover" loading="lazy" />
                  ) : (
                    <div className="h-12 w-8 shrink-0 rounded bg-white/5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white/85">{s.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {s.metadataSource === "mal" && <Badge tone="violet">MAL</Badge>}
                      {flagged && <Badge tone="pink">⚑ minor?</Badge>}
                      {/* meta shown inline on mobile only */}
                      <span className="text-[11px] text-white/35 sm:hidden">
                        {s.type} · {s.year ?? "—"} · {withVideo}/{s._count.episodes || s.totalEpisodes || 0} ep
                      </span>
                      <span className="sm:hidden">
                        <PublishBadge status={s.publish} />
                      </span>
                    </div>
                  </div>

                  {/* desktop columns */}
                  <span className="hidden w-14 text-sm text-white/50 sm:block">{s.type}</span>
                  <span className="hidden w-12 text-sm tabular-nums text-white/50 sm:block">{s.year ?? "—"}</span>
                  <span className="hidden w-24 text-sm tabular-nums text-white/60 sm:block">
                    {withVideo}
                    <span className="text-white/30"> / {s._count.episodes || s.totalEpisodes || 0}</span>
                    {withVideo > 0 && <span className="ml-1 text-emerald-400/70">●</span>}
                  </span>
                  <span className="hidden w-24 sm:block">
                    <PublishBadge status={s.publish} />
                  </span>
                  <span className="hidden w-16 text-right text-xs text-white/35 sm:block">
                    {timeAgo(s.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) => {
          const u = new URLSearchParams();
          for (const [k, v] of Object.entries(sp)) if (v && k !== "page") u.set(k, String(v));
          u.set("page", String(p));
          return `/admin/series?${u.toString()}`;
        }}
      />
    </div>
  );
}
