"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { AccountMenu } from "@/components/AccountMenu";

const YEAR = new Date().getFullYear();

const GENRES: { label: string; slug: string }[] = [
  { label: "Vanilla", slug: "vanilla" },
  { label: "Harem", slug: "harem" },
  { label: "NTR", slug: "ntr" },
  { label: "Big Breasts", slug: "big-breasts" },
  { label: "School", slug: "school" },
  { label: "Incest", slug: "incest" },
  { label: "MILF", slug: "milf" },
  { label: "Ahegao", slug: "ahegao" },
  { label: "Creampie", slug: "creampie" },
  { label: "Bondage", slug: "bondage" },
  { label: "Tentacles", slug: "tentacles" },
  { label: "Futanari", slug: "futanari" },
  { label: "Yuri", slug: "yuri" },
  { label: "Femdom", slug: "femdom" },
  { label: "Rape", slug: "rape" },
  { label: "Group", slug: "group" },
  { label: "Cosplay", slug: "cosplay" },
  { label: "Maid", slug: "maid" },
  { label: "Nurse", slug: "nurse" },
  { label: "Teacher", slug: "teacher" },
  { label: "Gyaru", slug: "gyaru" },
  { label: "Paizuri", slug: "paizuri" },
];

const MORE: { label: string; href: string }[] = [
  { label: "Trending", href: "/browse?sort=popular" },
  { label: "Top rated", href: "/browse?sort=rating" },
  { label: "Ongoing", href: "/browse?status=ongoing" },
  { label: "Release calendar", href: "/calendar" },
  { label: "Uncensored", href: "/browse?censored=false" },
  { label: `${YEAR} releases`, href: `/browse?year=${YEAR}` },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false); // mobile menu
  const [menu, setMenu] = useState<null | "series" | "more">(null);
  const [mobileSection, setMobileSection] = useState<null | "series" | "more">(null);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenu(null);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onClick);
    };
  }, []);

  const linkCls = (active: boolean) =>
    `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
    }`;

  // the admin console has its own chrome (AdminNav) — never the public header
  if (pathname.startsWith("/console")) return null;

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled || menu
          ? "border-b border-line bg-bg/85 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-bg/90 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:gap-4 lg:px-8">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/5 md:hidden"
        >
          <Bars open={open} />
        </button>

        <Link
          href="/"
          aria-label="LustHentai home"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-tight"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/android-chrome-192x192.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-lg shadow-glow"
          />
          <span className="hidden sm:inline">
            Lust<span className="text-accent">Hentai</span>
          </span>
        </Link>

        {/* desktop nav */}
        <div ref={navRef} className="hidden items-center gap-0.5 md:flex">
          <Link href="/" className={linkCls(pathname === "/")}>
            Home
            {pathname === "/" && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </Link>

          {/* Series mega dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setMenu("series")}
            onMouseLeave={() => setMenu(null)}
          >
            <button
              onClick={() => setMenu((m) => (m === "series" ? null : "series"))}
              className={linkCls(pathname.startsWith("/tag") || pathname === "/tags")}
              aria-expanded={menu === "series"}
            >
              Series
              <Caret />
            </button>
            {menu === "series" && (
              <div className="absolute left-0 top-full w-[520px] pt-2">
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Genres &amp; kinks
                    </span>
                    <Link href="/tags" className="text-xs font-medium text-accent hover:underline">
                      All genres →
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 p-3">
                    {GENRES.map((g) => (
                      <Link
                        key={g.slug}
                        href={`/tag/${g.slug}`}
                        className="rounded-lg px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                      >
                        {g.label}
                      </Link>
                    ))}
                  </div>
                  <Link
                    href="/browse"
                    className="block border-t border-line px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5"
                  >
                    Browse the full catalogue →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/browse?sort=new"
            className={linkCls(false)}
          >
            Latest
          </Link>

          {/* More dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setMenu("more")}
            onMouseLeave={() => setMenu(null)}
          >
            <button
              onClick={() => setMenu((m) => (m === "more" ? null : "more"))}
              className={linkCls(pathname.startsWith("/calendar"))}
              aria-expanded={menu === "more"}
            >
              More
              <Caret />
            </button>
            {menu === "more" && (
              <div className="absolute left-0 top-full w-52 pt-2">
                <div className="overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-card">
                  {MORE.map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="block px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                    >
                      {m.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto hidden min-w-0 max-w-sm flex-1 justify-end md:flex">
          <SearchBar />
        </div>

        <div className="ml-auto md:ml-0">
          <AccountMenu />
        </div>
      </div>

      {/* mobile search — always visible */}
      <div className="border-t border-line px-4 py-2.5 md:hidden">
        <SearchBar />
      </div>

      {/* mobile slide-down menu */}
      {open && (
        <div className="max-h-[70vh] overflow-y-auto border-t border-line bg-bg/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto max-w-content px-2 py-2">
            <Link href="/" className="block rounded-lg px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5">
              Home
            </Link>

            <MobileAccordion
              label="Series"
              open={mobileSection === "series"}
              onToggle={() =>
                setMobileSection((s) => (s === "series" ? null : "series"))
              }
            >
              <Link href="/browse" className="block rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5">
                All series
              </Link>
              <Link href="/tags" className="block rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5">
                All genres &amp; tags
              </Link>
              <div className="grid grid-cols-2 gap-0.5 pt-1">
                {GENRES.slice(0, 14).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/tag/${g.slug}`}
                    className="rounded-lg px-4 py-2 text-sm text-white/60 hover:bg-white/5"
                  >
                    {g.label}
                  </Link>
                ))}
              </div>
            </MobileAccordion>

            <Link href="/browse?sort=new" className="block rounded-lg px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5">
              Latest
            </Link>

            <MobileAccordion
              label="More"
              open={mobileSection === "more"}
              onToggle={() => setMobileSection((s) => (s === "more" ? null : "more"))}
            >
              {MORE.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="block rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                >
                  {m.label}
                </Link>
              ))}
            </MobileAccordion>
          </nav>
        </div>
      )}
    </header>
  );
}

function Caret() {
  return (
    <svg
      className="ml-1 inline-block -translate-y-px opacity-50"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function MobileAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5"
      >
        {label}
        <svg
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pb-2 pl-2">{children}</div>}
    </div>
  );
}

function Bars({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </>
      )}
    </svg>
  );
}
