"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Me = {
  handle: string;
  role: string;
  displayName?: string | null;
  avatarUrl?: string | null;
} | null;

export function AccountMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      setMe(await r.json());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refresh();

    // keep the header in sync with sign-in / sign-out (this tab and others) —
    // the layout doesn't remount on navigation, so without this the button
    // stays "Sign in" after logging in
    const supabase = (supabaseRef.current ??= createClient());
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setMe(null);
      else void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => setOpen(false), [me]);

  if (me === undefined) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-2" />;
  }

  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-px"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent-2 to-accent text-xs font-bold uppercase text-white ring-1 ring-white/10 transition-transform hover:scale-105"
      >
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          me.handle.slice(0, 2)
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-semibold">@{me.handle}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/50">
                {me.role.toLowerCase()}
              </p>
            </div>
            <Link href="/watchlist" className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/5">
              Watchlist
            </Link>
            <Link href="/history" className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/5">
              History
            </Link>
            <Link href="/account" className="block px-4 py-2.5 text-sm text-white/75 hover:bg-white/5">
              Account
            </Link>
            <button
              onClick={async () => {
                await (supabaseRef.current ??= createClient()).auth.signOut();
                setMe(null);
                setOpen(false);
                router.refresh();
              }}
              className="block w-full border-t border-line px-4 py-2.5 text-left text-sm text-accent hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
