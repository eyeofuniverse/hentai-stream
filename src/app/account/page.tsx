import { redirect } from "next/navigation";
import Link from "next/link";
import { viewer } from "@/lib/user";
import { myStats } from "@/lib/user-queries";
import { AccountForm } from "@/components/account/AccountForm";
import { SignOutButton } from "@/components/account/SignOutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const me = await viewer();
  if (!me) redirect("/login?next=/account");

  const stats = await myStats(me.id);
  const prefs =
    me.prefs && typeof me.prefs === "object" && !Array.isArray(me.prefs)
      ? (me.prefs as Record<string, unknown>)
      : {};
  const joined = new Date(me.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <nav className="mb-4 text-xs text-white/40">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Account</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* identity card */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface/40 p-4 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-surface-2 text-xl font-bold text-white/40 ring-1 ring-white/10">
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (me.displayName || me.handle).slice(0, 1).toUpperCase()
              )}
            </span>
            <p className="mt-2 truncate text-sm font-bold">
              {me.displayName || `@${me.handle}`}
            </p>
            <p className="truncate text-[11px] text-white/40">{me.email}</p>
            <p className="mt-1 text-[11px] text-white/30">Member since {joined}</p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-1">
            {[
              { n: stats.watchlist, l: "Watchlist", href: "/watchlist" },
              { n: stats.watched, l: "Watched", href: "/history" },
              { n: stats.ratings, l: "Ratings", href: null },
            ].map((s) =>
              s.href ? (
                <Link
                  key={s.l}
                  href={s.href}
                  className="rounded-xl border border-line bg-surface/40 p-3 text-center transition hover:border-accent/30 md:flex md:items-center md:justify-between md:text-left"
                >
                  <span className="font-display text-lg font-extrabold">{s.n}</span>
                  <span className="block text-[11px] text-white/40 md:inline">{s.l}</span>
                </Link>
              ) : (
                <div
                  key={s.l}
                  className="rounded-xl border border-line bg-surface/40 p-3 text-center md:flex md:items-center md:justify-between md:text-left"
                >
                  <span className="font-display text-lg font-extrabold">{s.n}</span>
                  <span className="block text-[11px] text-white/40 md:inline">{s.l}</span>
                </div>
              ),
            )}
          </div>

          <div className="space-y-1.5 text-sm">
            <Link href="/account/password" className="block text-white/50 hover:text-accent">
              Change password
            </Link>
            <SignOutButton />
          </div>
        </aside>

        {/* form */}
        <div>
          <h1 className="mb-5 font-display text-2xl font-extrabold tracking-tight">
            Account settings
          </h1>
          <AccountForm
            displayName={me.displayName ?? ""}
            avatarUrl={me.avatarUrl ?? ""}
            bio={me.bio ?? ""}
            autoplay={prefs.autoplay === true}
            showContentWarnings={prefs.showContentWarnings === true}
            emailOptIn={me.emailOptIn}
          />
        </div>
      </div>
    </main>
  );
}
