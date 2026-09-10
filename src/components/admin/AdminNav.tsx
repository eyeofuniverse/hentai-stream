"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Clapperboard,
  ShieldCheck,
  Flag,
  Puzzle,
  Tag,
  Search,
  Megaphone,
  DatabaseZap,
  Home,
  Menu,
  X,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: string; badge?: number; tone?: string };
export type NavGroup = { label: string | null; items: NavItem[] };

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  series: Clapperboard,
  review: ShieldCheck,
  reports: Flag,
  unmatched: Puzzle,
  tags: Tag,
  search: Search,
  ads: Megaphone,
  metadata: DatabaseZap,
};

const TONE: Record<string, string> = {
  amber: "#fbbf24",
  pink: "#ff3d7f",
  red: "#f87171",
  slate: "#8b8b99",
};

function Item({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = ICONS[item.icon] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors [touch-action:manipulation]"
      style={{
        background: active ? "rgba(255,61,127,0.12)" : "transparent",
        color: active ? "#ff3d7f" : "rgba(255,255,255,0.55)",
      }}
    >
      <Icon size={16} />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
          style={{
            background: `${TONE[item.tone ?? "slate"]}22`,
            color: TONE[item.tone ?? "slate"],
          }}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function List({ groups }: { groups: NavGroup[] }) {
  return (
    <nav className="flex flex-col gap-1">
      {groups.map((g, i) => (
        <div key={i} className={i > 0 ? "pt-3" : ""}>
          {g.label && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
              {g.label}
            </p>
          )}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <Item key={it.href} item={it} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-3 border-t border-white/10 pt-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-white/40 transition-colors hover:text-white"
        >
          <Home size={16} />
          View site
        </Link>
      </div>
    </nav>
  );
}

export function AdminNav({
  groups,
  handle,
  role,
}: {
  groups: NavGroup[];
  handle: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // close the drawer on navigation
  const key = pathname;

  return (
    <>
      {/* desktop */}
      <aside className="hidden shrink-0 md:block md:w-56">
        <div className="sticky top-6">
          <Link href="/admin" className="mb-6 flex items-center gap-2 px-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white">
              <Megaphone size={14} />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">
              Lust<span className="text-accent">Hentai</span>
            </span>
          </Link>
          <List groups={groups} />
          <div className="mt-5 border-t border-white/10 px-3 pt-4 text-xs">
            <div className="truncate text-white/60">@{handle}</div>
            <div className="mt-0.5 text-white/35">{role}</div>
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-display text-sm font-bold tracking-tight">
            Lust<span className="text-accent">Hentai</span>
            <span className="ml-1.5 font-medium text-white/30">admin</span>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 [touch-action:manipulation] active:bg-white/10"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {open && (
          <div key={key} className="border-t border-white/10 px-3 py-3" onClick={() => setOpen(false)}>
            <List groups={groups} />
          </div>
        )}
      </header>
    </>
  );
}
