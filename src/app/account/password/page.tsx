import { redirect } from "next/navigation";
import Link from "next/link";
import { viewer } from "@/lib/user";
import { PasswordForm } from "@/components/PasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Password", robots: { index: false } };

export default async function PasswordPage() {
  const me = await viewer();
  if (!me) redirect("/login?next=/account/password");

  return (
    <main className="mx-auto max-w-sm px-4 py-10 lg:px-8">
      <nav className="mb-4 text-xs text-white/50">
        <Link href="/account" className="hover:text-white">Account</Link>
        <span className="mx-1.5">/</span>
        <span className="text-white/60">Password</span>
      </nav>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Set a new password
      </h1>
      <p className="mb-6 mt-1 text-sm text-white/45">For {me.email}</p>
      <PasswordForm />
    </main>
  );
}
