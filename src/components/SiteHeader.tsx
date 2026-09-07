import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { AccountMenu } from "@/components/AccountMenu";

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/browse?sort=new", label: "Latest" },
  { href: "/browse?status=ongoing", label: "Ongoing" },
  { href: "/tags", label: "Tags" },
];

/** Static — no per-request DB/auth work. Account state hydrates client-side. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-bg/85 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-black tracking-tight">
          Hentai<span className="text-accent">Stream</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-white/60 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden flex-1 justify-end md:flex">
          <SearchBar />
        </div>

        <AccountMenu />
      </div>

      <div className="border-t border-white/8 px-4 py-2 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
