import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login");
  if (session.profile.role !== "ADMIN" && session.profile.role !== "MODERATOR") {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/series" className="text-white/60 hover:text-white">Series</Link>
        <Link href="/admin/metadata" className="text-white/60 hover:text-white">Metadata</Link>
        <Link href="/admin/reports" className="text-white/60 hover:text-white">Reports</Link>
        <Link href="/" className="ml-auto text-white/40 hover:text-white">↗ site</Link>
      </div>
      {children}
    </div>
  );
}
