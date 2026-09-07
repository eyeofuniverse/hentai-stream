"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Me = { handle: string; role: string } | null;

export function AccountMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => alive && setMe(d))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, []);

  if (me === undefined) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-2" />;
  }

  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold"
      >
        Sign in
      </Link>
    );
  }

  const isStaff = me.role === "ADMIN" || me.role === "MODERATOR";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-sm font-bold uppercase"
      >
        {me.handle.slice(0, 2)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-surface text-sm">
            <Link href="/watchlist" className="block px-4 py-2.5 hover:bg-white/5">
              Watchlist
            </Link>
            <Link href="/submit" className="block px-4 py-2.5 hover:bg-white/5">
              Submit episode
            </Link>
            {isStaff && (
              <Link href="/admin" className="block px-4 py-2.5 hover:bg-white/5">
                Admin
              </Link>
            )}
            <button
              onClick={async () => {
                await createClient().auth.signOut();
                setMe(null);
                router.refresh();
              }}
              className="block w-full border-t border-white/10 px-4 py-2.5 text-left text-accent hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
