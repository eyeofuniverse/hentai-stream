import { prisma, db } from "@/lib/db";
import { PageHeader, FilterTabs, EmptyState, inputCls } from "@/components/console/ui";
import { TagRow } from "@/components/console/TagRow";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

type SP = { cat?: string; q?: string; view?: string };

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const cat = (sp.cat ?? "ALL").toUpperCase();
  const view = sp.view ?? "all";

  const where = {
    ...(cat !== "ALL" ? { category: cat as never } : {}),
    ...(view === "featured" ? { featured: true } : {}),
    ...(view === "orphan" ? { seriesCount: 0 } : {}),
    ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}),
  };

  const [tags, counts, featuredCount, orphanCount] = await db(() =>
    Promise.all([
      prisma.tag.findMany({
        where,
        orderBy: [{ seriesCount: "desc" }, { name: "asc" }],
        take: 400,
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          seriesCount: true,
          featured: true,
        },
      }),
      prisma.tag.groupBy({ by: ["category"], _count: true }),
      prisma.tag.count({ where: { featured: true } }),
      prisma.tag.count({ where: { seriesCount: 0 } }),
    ]),
  );

  const countBy = Object.fromEntries(counts.map((c) => [c.category, c._count]));
  const total = Object.values(countBy).reduce((a, b) => a + b, 0);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams({ ...sp, ...patch } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/console/tags?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Tags & genres"
        subtitle="Rename, re-categorise, feature, or merge tags. Slugs are permanent (SEO). Merging moves every series onto the target and recounts."
      />

      <form className="mb-3">
        {(["cat", "view"] as const).map((k) =>
          sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null,
        )}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search tag names…"
          className={`${inputCls} max-w-xs`}
        />
      </form>

      <div className="mb-3 space-y-2">
        <FilterTabs
          current={cat}
          hrefFor={(v) => qs({ cat: v === "ALL" ? undefined : v })}
          options={[
            { value: "ALL", label: "All", count: total },
            { value: "GENRE", label: "Genre", count: countBy.GENRE ?? 0 },
            { value: "THEME", label: "Theme", count: countBy.THEME ?? 0 },
            { value: "FETISH", label: "Fetish", count: countBy.FETISH ?? 0 },
            { value: "FORMAT", label: "Format", count: countBy.FORMAT ?? 0 },
            {
              value: "CONTENT_WARNING",
              label: "CW",
              count: countBy.CONTENT_WARNING ?? 0,
            },
          ]}
        />
        <FilterTabs
          current={view}
          hrefFor={(v) => qs({ view: v === "all" ? undefined : v })}
          options={[
            { value: "all", label: "Any" },
            { value: "featured", label: "★ Featured", count: featuredCount },
            { value: "orphan", label: "Unused", count: orphanCount },
          ]}
        />
      </div>

      {tags.length === 0 ? (
        <EmptyState title="No tags match." />
      ) : (
        <div className="grid gap-1.5">
          {tags.map((t) => (
            <TagRow key={t.id} tag={t} />
          ))}
        </div>
      )}
      {tags.length === 400 && (
        <p className="mt-3 text-xs text-white/35">
          Showing first 400 — narrow with search or a filter.
        </p>
      )}
    </div>
  );
}
