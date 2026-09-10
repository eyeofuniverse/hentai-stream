import { redirect } from "next/navigation";
import Link from "next/link";
import { viewer } from "@/lib/user";
import { myWatchlist } from "@/lib/user-queries";
import { SeriesCard } from "@/components/SeriesCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Watchlist", robots: { index: false } };

const TABS = [
  { key: "ALL", label: "All" },
  { key: "WATCHING", label: "Watching" },
  { key: "PLAN_TO_WATCH", label: "Plan to watch" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ON_HOLD", label: "On hold" },
  { key: "DROPPED", label: "Dropped" },
];

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await viewer();
  if (!me) redirect("/login?next=/watchlist");

  const { status = "ALL" } = await searchParams;
  const rows = await myWatchlist(me.id);
  const counts = rows.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  const shown =
    status === "ALL" ? rows : rows.filter((r) => r.status === status);

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <nav className="mb-4 text-xs text-white/40">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Watchlist</span>
      </nav>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        My watchlist
      </h1>
      <p className="mt-1 text-sm text-white/45">{rows.length} series saved</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n = t.key === "ALL" ? rows.length : counts[t.key] ?? 0;
          const active = status === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "ALL" ? "/watchlist" : `/watchlist?status=${t.key}`}
              className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${
                active
                  ? "bg-accent text-white"
                  : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {t.label}
              {n > 0 && <span className={active ? "ml-1 text-white/70" : "ml-1 text-white/30"}>{n}</span>}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-sm text-white/45">Nothing here yet.</p>
          <Link
            href="/browse"
            className="mt-3 inline-block rounded-lg bg-white/5 px-4 py-2 text-xs font-semibold text-accent hover:bg-white/10"
          >
            Browse the catalogue →
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
          {shown.map((r) => (
            <SeriesCard key={r.series.slug} series={r.series} />
          ))}
        </div>
      )}
    </main>
  );
}
