/**
 * One-time backfill: write a real, data-driven bodyMd paragraph for every
 * Studio and Tag that doesn't have one yet. Verified before writing this:
 * 0 of 160 studios and 106 of 145 tags had any custom bodyMd — every one of
 * those pages fell back to the same one-line template with only the entity's
 * name swapped in (tag/[slug]/page.tsx's tagDescription(), the equivalent in
 * studio/[slug]/page.tsx) — textbook thin/near-duplicate taxonomy-page
 * content that keeps auto-generated hub pages from ranking.
 *
 * Composed from each entity's own real series (counts, year range, most-
 * viewed titles, co-occurring tags/studios) — no LLM calls, deterministic,
 * free, re-runnable. A handful of varied sentence skeletons (picked by
 * hashing the slug) keep the wording structure from being identical across
 * every row even though the underlying template shape repeats — the actual
 * substituted facts differ per entity either way.
 *
 *   npx tsx --env-file=.env scripts/backfill-hub-copy.mts [--limit=N] [--redo]
 */
import { prisma, db } from "@/lib/db";
import { SITE_NAME } from "@/lib/seo";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const redo = args.includes("--redo");

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function topByFreq(names: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}

function yearsPhrase(years: (number | null)[]): string {
  const real = years.filter((y): y is number => y != null);
  if (!real.length) return "";
  const min = Math.min(...real);
  const max = Math.max(...real);
  return min === max ? ` from ${min}` : ` spanning ${min}–${max}`;
}

async function studioBody(studio: { id: string; name: string; slug: string; type: string }) {
  const series = await db(() =>
    prisma.series.findMany({
      where: { studioId: studio.id, publish: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      select: { title: true, year: true, tags: { select: { name: true } } },
    }),
  );
  if (!series.length) return null;

  const count = series.length;
  const plural = count === 1 ? "" : "s";
  const tags = topByFreq(series.flatMap((s) => s.tags.map((t) => t.name)), 3);
  const notable = series.slice(0, 3).map((s) => s.title);
  const years = yearsPhrase(series.map((s) => s.year));
  const kind = studio.type === "CIRCLE" ? "circle" : studio.type === "LABEL" ? "label" : "studio";

  const skeletons = [
    `${studio.name} is a hentai ${kind} with ${count} title${plural} on ${SITE_NAME}${years}.` +
      (tags.length ? ` Its catalogue leans heavily into ${joinList(tags)}` : "") +
      (notable.length ? `, and includes fan favorites like ${joinList(notable)}.` : "."),
    `Browsing ${studio.name}'s hentai output turns up ${count} series${years} streaming free on ${SITE_NAME}.` +
      (tags.length ? ` Most of it is tagged ${joinList(tags)}.` : "") +
      (notable.length ? ` Start with ${joinList(notable)} if you're new to the ${kind}.` : ""),
    `${studio.name} has ${count} hentai title${plural} streaming free in HD on ${SITE_NAME}${years}.` +
      (tags.length ? ` Recurring themes across the catalogue include ${joinList(tags)}` : "") +
      (notable.length ? `, with ${joinList(notable)} among the most-watched.` : "."),
  ];
  return skeletons[hashStr(studio.slug) % skeletons.length];
}

async function tagBody(tag: { id: string; name: string; slug: string }) {
  const series = await db(() =>
    prisma.series.findMany({
      where: { tags: { some: { id: tag.id } }, publish: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      select: { title: true, year: true, studio: { select: { name: true } } },
    }),
  );
  if (!series.length) return null;

  const count = series.length;
  const plural = count === 1 ? "" : "s";
  const studios = topByFreq(
    series.map((s) => s.studio?.name).filter((n): n is string => !!n),
    3,
  );
  const notable = series.slice(0, 3).map((s) => s.title);
  const years = yearsPhrase(series.map((s) => s.year));

  const skeletons = [
    `${tag.name} hentai spans ${count} series and OVA${plural} on ${SITE_NAME}${years}.` +
      (studios.length
        ? ` ${joinList(studios)} ${studios.length === 1 ? "shows" : "show"} up most often in the catalogue,`
        : "") +
      (notable.length
        ? ` and ${joinList(notable)} ${notable.length === 1 ? "is" : "are"} among the most-watched titles.`
        : "."),
    `${count} ${tag.name} title${plural} stream free in HD on ${SITE_NAME}${years}.` +
      (notable.length ? ` ${joinList(notable)} ${notable.length === 1 ? "is" : "are"} a good place to start,` : "") +
      (studios.length
        ? ` and ${joinList(studios)} ${studios.length === 1 ? "is" : "are"} the studio${studios.length === 1 ? "" : "s"} behind a lot of it.`
        : "."),
    `Looking for ${tag.name} hentai? ${SITE_NAME} has ${count} series and OVA${plural}${years}.` +
      (notable.length ? ` Fan favorites include ${joinList(notable)}.` : ""),
  ];
  return skeletons[hashStr(tag.slug) % skeletons.length];
}

const studios = await db(() =>
  prisma.studio.findMany({
    where: { seriesCount: { gt: 0 }, ...(redo ? {} : { bodyMd: null }) },
    orderBy: { seriesCount: "desc" },
    take: limit,
    select: { id: true, name: true, slug: true, type: true },
  }),
);
console.log(`${studios.length} studios to write`);
let sOk = 0;
for (const s of studios) {
  const body = await studioBody(s);
  if (!body) continue;
  await db(() => prisma.studio.update({ where: { id: s.id }, data: { bodyMd: body } }));
  sOk++;
}
console.log(`studios done: ${sOk}/${studios.length}`);

const tags = await db(() =>
  prisma.tag.findMany({
    where: { seriesCount: { gt: 0 }, ...(redo ? {} : { bodyMd: null }) },
    orderBy: { seriesCount: "desc" },
    take: limit,
    select: { id: true, name: true, slug: true },
  }),
);
console.log(`${tags.length} tags to write`);
let tOk = 0;
for (const t of tags) {
  const body = await tagBody(t);
  if (!body) continue;
  await db(() => prisma.tag.update({ where: { id: t.id }, data: { bodyMd: body } }));
  tOk++;
}
console.log(`tags done: ${tOk}/${tags.length}`);

console.log("\n── done ──");
await prisma.$disconnect();
