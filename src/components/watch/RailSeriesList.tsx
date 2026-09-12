import Link from "next/link";
import { cover } from "@/lib/cloudinary";
import { SmartImg } from "@/components/SmartImg";

type S = {
  slug: string;
  title: string;
  coverUrl: string | null;
  year?: number | null;
  type?: string | null;
  externalScore?: number | null;
  _count?: { episodes: number };
};

/** Compact vertical list of series for the watch-page rail — poster + title. */
export function RailSeriesList({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: S[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/50">
      <Link
        href={href}
        className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 transition-colors hover:bg-white/[0.03]"
      >
        <span className="font-display text-sm font-bold">{title}</span>
        <span className="text-xs text-white/50">See all →</span>
      </Link>
      <ul className="divide-y divide-line/60">
        {items.slice(0, 6).map((s, i) => (
          <li key={s.slug}>
            <Link
              href={`/hentai/${s.slug}`}
              className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
            >
              <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-white/50">
                {i + 1}
              </span>
              <span className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
                <SmartImg
                  src={cover(s.coverUrl)}
                  seed={s.slug}
                  alt=""
                  width={80}
                  height={120}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/85 transition-colors group-hover:text-accent">
                  {s.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-white/50">
                  {[s.type, s.year, s._count?.episodes ? `${s._count.episodes} ep` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
