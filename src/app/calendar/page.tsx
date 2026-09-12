import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { calendarMonth, miniLists, type CalendarEntry } from "@/lib/queries";
import { thumb, episodeThumb } from "@/lib/cloudinary";
import { SmartImg } from "@/components/SmartImg";
import { CalendarTabs } from "@/components/CalendarTabs";
import { SITE, SITE_NAME, breadcrumbLd } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Hentai Release Calendar — New Episodes by Date",
  description:
    "The hentai release calendar — every subbed and uncensored episode by air date. See what dropped this month and jump back through past releases on LustHentai.",
  alternates: { canonical: "/calendar" },
  openGraph: { title: "Hentai Release Calendar", url: "/calendar" },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(m: string | undefined): { y: number; mo: number } {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) return { y, mo };
  }
  return { y: now.getUTCFullYear(), mo: now.getUTCMonth() + 1 };
}

const key = (y: number, mo: number) => `${y}-${String(mo).padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const mRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const { y, mo } = parseMonth(mRaw);

  const [{ entries, latestAiredAt }, mini] = await Promise.all([
    calendarMonth(y, mo),
    miniLists(),
  ]);

  const prev = mo === 1 ? { y: y - 1, mo: 12 } : { y, mo: mo - 1 };
  const next = mo === 12 ? { y: y + 1, mo: 1 } : { y, mo: mo + 1 };

  // group by UTC day
  const byDay = new Map<number, CalendarEntry[]>();
  for (const e of entries) {
    const d = new Date(e.airedAt).getUTCDate();
    const bucket = byDay.get(d);
    if (bucket) bucket.push(e);
    else byDay.set(d, [e]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  const latestKey = latestAiredAt
    ? key(
        new Date(latestAiredAt).getUTCFullYear(),
        new Date(latestAiredAt).getUTCMonth() + 1,
      )
    : null;
  const onLatest = latestKey === key(y, mo);

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Release calendar", path: "/calendar" },
  ]);
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Hentai Release Calendar",
    description:
      "Hentai episodes by air date — subbed and uncensored, updated as new releases land.",
    url: `${SITE}/calendar`,
    isFamilyFriendly: false,
  };

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <nav className="mb-4 text-xs text-white/50" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Release calendar</span>
      </nav>

      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Hentai release calendar
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-white/45">
        Every episode by the date it aired — subbed and uncensored. New drops
        land here as soon as they&apos;re out.
      </p>

      <AdSlot slotKey="calendar-top" className="mt-6" />

      {/* month switcher */}
      <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface/50 p-3">
        <Link
          href={`/calendar?m=${key(prev.y, prev.mo)}`}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-white/60 transition hover:border-accent/40 hover:text-white"
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <p className="font-display text-base font-bold">
          {MONTHS[mo - 1]} {y}
        </p>
        <Link
          href={`/calendar?m=${key(next.y, next.mo)}`}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-white/60 transition hover:border-accent/40 hover:text-white"
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {days.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-sm text-white/45">
            No dated releases in {MONTHS[mo - 1]} {y}.
          </p>
          {latestKey && !onLatest && (
            <Link
              href={`/calendar?m=${latestKey}`}
              className="mt-3 inline-block rounded-lg bg-white/5 px-4 py-2 text-xs font-semibold text-accent hover:bg-white/10"
            >
              Jump to the latest releases →
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {days.map((d) => {
            const list = byDay.get(d)!;
            const date = new Date(Date.UTC(y, mo - 1, d));
            return (
              <section key={d} className="flex gap-4">
                <div className="w-12 shrink-0 text-right">
                  <p className="font-display text-2xl font-extrabold leading-none">{d}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-white/50">
                    {DOW[date.getUTCDay()]}
                  </p>
                </div>
                <div className="min-w-0 flex-1 space-y-2 border-l border-line pl-4">
                  {list.map((e, idx) => {
                    const hosted = episodeThumb(e) ?? thumb(e.coverUrl);
                    return (
                      <Link
                        key={`${e.seriesSlug}-${e.number}-${idx}`}
                        href={`/hentai/${e.seriesSlug}/${e.number}`}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-2 transition hover:border-accent/40 hover:bg-surface"
                      >
                        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-28">
                          <SmartImg
                            src={hosted}
                            fallback={thumb(e.coverUrl)}
                            seed={`${e.seriesSlug}-${e.number}`}
                            width={280}
                            height={158}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-white/90 group-hover:text-accent">
                            {e.seriesTitle}
                          </p>
                          <p className="mt-0.5 text-xs text-white/45">
                            Episode {e.number}
                          </p>
                        </div>
                        <span className="pr-1 text-white/50 transition group-hover:text-accent">
                          →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-14">
        <CalendarTabs popular={mini.popular} fresh={mini.fresh} />
      </div>
    </main>
  );
}
