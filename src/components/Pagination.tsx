import Link from "next/link";

/**
 * Real numbered pagination (crawlable `?page=N` links, no client JS). Keeps any
 * existing query params and just swaps `page`.
 */
export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  /** given a page number, return its href */
  makeHref: (p: number) => string;
}) {
  if (pages <= 1) return null;

  const nums: (number | "…")[] = [];
  const push = (n: number | "…") => nums.push(n);
  const span = 1;
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || (p >= page - span && p <= page + span)) {
      push(p);
    } else if (nums[nums.length - 1] !== "…") {
      push("…");
    }
  }

  const cell =
    "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-semibold transition";

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link href={makeHref(page - 1)} rel="prev" className={`${cell} border border-line text-white/70 hover:border-accent/40 hover:text-white`}>
          ‹ Prev
        </Link>
      ) : (
        <span className={`${cell} border border-line/40 text-white/50`}>‹ Prev</span>
      )}

      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className={`${cell} text-white/50`}>
            …
          </span>
        ) : n === page ? (
          <span
            key={n}
            aria-current="page"
            className={`${cell} bg-gradient-to-r from-accent to-accent-2 text-white shadow-glow`}
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={makeHref(n)}
            className={`${cell} border border-line text-white/70 hover:border-accent/40 hover:text-white`}
          >
            {n}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link href={makeHref(page + 1)} rel="next" className={`${cell} border border-line text-white/70 hover:border-accent/40 hover:text-white`}>
          Next ›
        </Link>
      ) : (
        <span className={`${cell} border border-line/40 text-white/50`}>Next ›</span>
      )}
    </nav>
  );
}
