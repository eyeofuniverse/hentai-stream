import Link from "next/link";
import type { Metadata } from "next";
import { prisma, db } from "@/lib/db";
import { socialMeta } from "@/lib/seo";

export const revalidate = 21600;

const AZ_TITLE = "A-Z Hentai List — Every Series & OVA";
const AZ_DESC =
  "Every hentai series and OVA on LustHentai, listed alphabetically — find a title by name.";

export const metadata: Metadata = {
  title: AZ_TITLE,
  description: AZ_DESC,
  alternates: { canonical: "/az" },
  ...socialMeta({ title: AZ_TITLE, description: AZ_DESC, path: "/az" }),
};

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function bucketOf(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

function getAll() {
  return db(() =>
    prisma.series.findMany({
      where: { publish: "PUBLISHED" },
      orderBy: { title: "asc" },
      select: { slug: true, title: true, year: true },
    }),
  );
}

export default async function AzPage() {
  const series = await getAll().catch(() => [] as Awaited<ReturnType<typeof getAll>>);

  const groups = new Map<string, typeof series>();
  for (const s of series) {
    const b = bucketOf(s.title);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(s);
  }

  return (
    <main className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">A-Z hentai list</h1>
      <p className="mt-1 text-sm text-white/45">
        {series.length.toLocaleString()} series and OVAs, alphabetically.
      </p>

      <nav
        aria-label="Jump to letter"
        className="sticky top-0 z-10 -mx-4 mt-6 flex flex-wrap gap-1 border-y border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
      >
        {LETTERS.map((l) => {
          const has = groups.has(l);
          return has ? (
            <a
              key={l}
              href={`#${l}`}
              className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-white/70 transition hover:bg-accent hover:text-white"
            >
              {l}
            </a>
          ) : (
            <span
              key={l}
              className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-white/20"
            >
              {l}
            </span>
          );
        })}
      </nav>

      {LETTERS.filter((l) => groups.has(l)).map((l) => (
        <section key={l} id={l} className="scroll-mt-16 border-b border-line py-6">
          <h2 className="mb-3 font-display text-lg font-extrabold text-accent">{l}</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.get(l)!.map((s) => (
              <Link
                key={s.slug}
                href={`/hentai/${s.slug}`}
                className="truncate text-sm text-white/70 transition hover:text-accent"
              >
                {s.title}
                {s.year ? <span className="text-white/35"> ({s.year})</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
