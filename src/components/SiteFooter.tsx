"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Browse",
    links: [
      { href: "/browse", label: "All titles" },
      { href: "/browse?sort=new", label: "Latest additions" },
      { href: "/browse?sort=popular", label: "Most viewed" },
      { href: "/browse?status=ongoing", label: "Ongoing" },
      { href: "/browse?censored=false", label: "Uncensored" },
      { href: "/calendar", label: "Release calendar" },
      { href: "/tags", label: "Genres & tags" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/dmca", label: "DMCA" },
      { href: "/2257", label: "18 U.S.C. § 2257" },
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/report-content", label: "Report content" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname() || "/";
  // the admin console has its own chrome — never the public footer
  if (pathname.startsWith("/console")) return null;

  return (
    <footer className="mt-20 border-t border-line bg-surface/30">
      <div className="mx-auto max-w-content px-4 py-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/android-chrome-192x192.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 rounded-lg"
              />
              Lust<span className="text-accent">Hentai</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/45">
              Stream subbed, dubbed and uncensored hentai — series, OVAs and movies,
              in your own player. Updated daily.
            </p>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {c.title}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-white/55">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-xs leading-relaxed text-white/30">
            LustHentai streams animated adult content. All characters depicted are
            fictional and represented as adults (18+). No real persons appear in any
            content, so the record-keeping requirements of 18 U.S.C. § 2257 do not
            apply. 18+ only.
          </p>
          <p className="mt-3 text-xs text-white/25">
            © {new Date().getFullYear()} LustHentai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
