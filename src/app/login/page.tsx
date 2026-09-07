import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  const session = await getSessionUser().catch(() => null);
  if (session) redirect("/");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-1 text-center text-xl font-black">
        Hentai<span className="text-accent">Stream</span>
      </Link>
      <p className="mb-8 text-center text-sm text-white/45">
        Sign in to build a watchlist and submit episodes
      </p>
      <AuthForm />
      <Link href="/" className="mt-5 text-center text-xs text-white/40 underline">
        Continue without an account
      </Link>
    </main>
  );
}
