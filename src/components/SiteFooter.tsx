import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/8 bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/50">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/browse">Browse</Link>
          <Link href="/tags">Tags</Link>
          <Link href="/dmca">DMCA</Link>
          <Link href="/2257">2257 Statement</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/report-content">Report content</Link>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-white/35">
          LustHentai streams animated adult content. All characters depicted are
          fictional and represented as adults (18+). No real persons appear in any
          content, so the record-keeping requirements of 18 U.S.C. § 2257 do not
          apply. 18+ only.
        </p>
        <p className="mt-3 text-xs text-white/25">
          © {new Date().getFullYear()} LustHentai
        </p>
      </div>
    </footer>
  );
}
