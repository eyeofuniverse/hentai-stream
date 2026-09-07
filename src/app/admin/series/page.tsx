import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminSeriesList({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter, q } = await searchParams;
  const list = await prisma.series.findMany({
    where: {
      ...(filter === "pending" ? { publish: "PENDING" } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Series</h1>
        <Link href="/admin/series/new" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold">
          + New
        </Link>
      </div>

      <form className="mb-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title…"
          className="w-full max-w-xs rounded-lg border border-white/10 bg-surface p-2 text-sm outline-none"
        />
      </form>

      <div className="grid gap-1.5">
        {list.map((s) => (
          <Link
            key={s.id}
            href={`/admin/series/${s.id}`}
            className="flex items-center gap-3 rounded-lg border border-white/8 bg-surface px-3 py-2 text-sm hover:border-accent/40"
          >
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            <span className="shrink-0 text-xs text-white/40">{s._count.episodes} ep</span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                s.publish === "PUBLISHED"
                  ? "bg-green-500/20 text-green-400"
                  : s.publish === "PENDING"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-white/10 text-white/50"
              }`}
            >
              {s.publish}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
