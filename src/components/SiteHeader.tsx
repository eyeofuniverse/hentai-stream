"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { AccountMenu } from "@/components/AccountMenu";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/browse", label: "Browse", match: (p: string) => p.startsWith("/browse") },
  { href: "/browse?sort=new", label: "Latest", match: () => false },
  { href: "/browse?status=ongoing", label: "Ongoing", match: () => false },
  { href: "/tags", label: "Genres", match: (p: string) => p.startsWith("/tag") },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-bg/90 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:gap-5 lg:px-8">
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
          className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm text-white shadow-glow">
            L
          </span>
          <span className="hidden sm:inline">
            Lust<span className="text-accent">Hentai</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 text-sm md:flex">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.label}
                href={n.href}
                className={`relative rounded-lg px-3 py-2 font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {n.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

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
        <div className="border-t border-line bg-bg/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto max-w-content px-2 py-2">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="block rounded-lg px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
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
