import Link from "next/link";
import { ResetForm } from "@/components/ResetForm";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[75vh] max-w-sm flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-6 flex items-center justify-center gap-2 font-display text-xl font-extrabold"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        Lust<span className="text-accent">Hentai</span>
      </Link>
      <h1 className="text-center font-display text-lg font-extrabold">
        Reset your password
      </h1>
      <p className="mb-6 mt-1 text-center text-sm text-white/45">
        We&apos;ll email you a link to set a new one.
      </p>
      <ResetForm />
      <Link
        href="/login"
        className="mt-6 text-center text-xs text-white/40 hover:text-white"
      >
        ← Back to sign in
      </Link>
    </main>
  );
}
