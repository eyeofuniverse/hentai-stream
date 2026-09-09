import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  const session = await getSessionUser().catch(() => null);
  if (session) redirect("/");

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-sm flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-1 flex items-center justify-center gap-2 font-display text-xl font-extrabold"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        Lust<span className="text-accent">Hentai</span>
      </Link>
      <p className="mb-8 text-center text-sm text-white/45">
        Sign in to build a watchlist and submit episodes
      </p>
      <AuthForm />
      <Link
        href="/"
        className="mt-6 text-center text-xs text-white/40 underline hover:text-white"
      >
        Continue without an account
      </Link>
    </main>
  );
}
