import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 font-display text-xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-white/45">
        This title may have been removed, or the link is wrong.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
        >
          Home
        </Link>
        <Link
          href="/browse"
          className="rounded-xl border border-line bg-surface px-6 py-2.5 text-sm font-medium transition hover:border-accent/40"
        >
          Browse
        </Link>
      </div>
    </main>
  );
}
