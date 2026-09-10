import { redirect } from "next/navigation";
import Link from "next/link";
import { viewer } from "@/lib/user";
import { updateProfile } from "@/lib/profile-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account", robots: { index: false } };

const inputCls =
  "w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none transition focus:border-accent/50";

export default async function AccountPage() {
  const me = await viewer();
  if (!me) redirect("/login?next=/account");

  const prefs = (me.prefs as Record<string, unknown>) ?? {};

  return (
    <main className="mx-auto max-w-lg px-4 py-10 lg:px-8">
      <nav className="mb-4 text-xs text-white/40">
        <Link href="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Account</span>
      </nav>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Account</h1>
      <p className="mt-1 text-sm text-white/45">
        Signed in as <span className="text-white/70">{me.email}</span> · @{me.handle}
      </p>

      <form action={updateProfile} className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
            Display name
          </label>
          <input name="displayName" defaultValue={me.displayName ?? ""} maxLength={40} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
            Avatar URL
          </label>
          <input
            name="avatarUrl"
            type="url"
            defaultValue={me.avatarUrl ?? ""}
            placeholder="https://…"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
            Bio
          </label>
          <textarea name="bio" defaultValue={me.bio ?? ""} rows={3} maxLength={300} className={inputCls} />
        </div>

        <fieldset className="space-y-2 rounded-xl border border-line bg-surface/40 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-white/40">
            Preferences
          </legend>
          <label className="flex items-center gap-2.5 text-sm text-white/75">
            <input
              type="checkbox"
              name="autoplay"
              defaultChecked={prefs.autoplay === true}
              className="h-4 w-4 accent-[color:#ff3d7f]"
            />
            Autoplay the next episode
          </label>
          <label className="flex items-center gap-2.5 text-sm text-white/75">
            <input
              type="checkbox"
              name="showContentWarnings"
              defaultChecked={prefs.showContentWarnings === true}
              className="h-4 w-4 accent-[color:#ff3d7f]"
            />
            Show content warnings before playing
          </label>
          <label className="flex items-center gap-2.5 text-sm text-white/75">
            <input
              type="checkbox"
              name="emailOptIn"
              defaultChecked={me.emailOptIn}
              className="h-4 w-4 accent-[color:#ff3d7f]"
            />
            Email me about new episodes on my watchlist
          </label>
        </fieldset>

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-2.5 text-sm font-bold text-white shadow-glow"
        >
          Save
        </button>
      </form>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/watchlist" className="text-accent hover:underline">My watchlist</Link>
        <Link href="/history" className="text-accent hover:underline">Watch history</Link>
      </div>
    </main>
  );
}
