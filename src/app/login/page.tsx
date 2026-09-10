import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Sign in", robots: { index: false } };

const PERKS = [
  { t: "Watchlist", d: "Save series and pick up where you left off" },
  { t: "History", d: "Everything you've watched, in one place" },
  { t: "Ratings", d: "Score series 1–10 and shape the rankings" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const dest = safeNext(next);
  const session = await getSessionUser().catch(() => null);
  if (session) redirect(dest);

  return (
    <main className="mx-auto grid min-h-[80vh] max-w-4xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16">
      {/* value panel — desktop only */}
      <div className="hidden lg:block">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Lust<span className="text-accent">Hentai</span>
        </Link>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
          A free account keeps your place across devices — no ads-tier upsell, no
          paywall.
        </p>
        <ul className="mt-6 space-y-3">
          {PERKS.map((p) => (
            <li key={p.t} className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span>
                <span className="text-sm font-semibold text-white/85">{p.t}</span>
                <span className="block text-xs text-white/40">{p.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* form */}
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 font-display text-xl font-extrabold lg:hidden"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Lust<span className="text-accent">Hentai</span>
        </Link>

        <h1 className="font-display text-xl font-extrabold tracking-tight">
          Welcome back
        </h1>
        <p className="mb-6 mt-1 text-sm text-white/45">
          Sign in, or create a free account.
        </p>

        {error === "auth" && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            That link didn&apos;t work or has expired — try again.
          </p>
        )}

        <AuthForm next={dest} />

        <Link
          href={dest}
          className="mt-6 block text-center text-xs text-white/35 underline-offset-2 hover:text-white/60 hover:underline"
        >
          Continue without an account
        </Link>
      </div>
    </main>
  );
}
