import { redirect } from "next/navigation";
import Link from "next/link";
import { viewer } from "@/lib/user";
import { myHistory } from "@/lib/user-queries";
import { SmartImg } from "@/components/SmartImg";
import { thumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumb } from "@/lib/hosting/bunny";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watch History", robots: { index: false } };

export default async function HistoryPage() {
  const me = await viewer();
  if (!me) redirect("/login?next=/history");

  const rows = await myHistory(me.id, 80);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <nav className="mb-4 text-xs text-white/40">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">History</span>
      </nav>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Watch history</h1>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-white/45">
          You haven&apos;t watched anything yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((r, i) => {
            const e = r.episode;
            const t =
              e.bunnyStatus === "ready" && e.bunnyGuid
                ? bunnyThumb(e.bunnyGuid)
                : thumb(e.thumbUrl) ?? thumb(e.series.coverUrl);
            return (
              <li key={`${e.series.slug}-${e.number}-${i}`}>
                <Link
                  href={`/hentai/${e.series.slug}/${e.number}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-2 transition hover:border-accent/40 hover:bg-surface"
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-32">
                    <SmartImg
                      src={t}
                      fallback={thumb(e.series.coverUrl)}
                      seed={`${e.series.slug}-${e.number}`}
                      width={280}
                      height={158}
                      className="h-full w-full object-cover"
                    />
                    {r.completed && (
                      <span className="absolute bottom-1 right-1 rounded bg-good/85 px-1.5 py-0.5 text-[9px] font-bold text-black">
                        WATCHED
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white/85 group-hover:text-accent">
                      {e.series.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      Episode {e.number}
                      {e.title ? ` · ${e.title}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
