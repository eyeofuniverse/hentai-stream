/**
 * One-off (re-runnable, resumable) tag cleanup:
 *   1. merge duplicate tags onto their canonical dictionary tag
 *      (nakadashi → creampie, fellatio → blowjob, non-consensual → rape, …)
 *   2. PURGE non-genres — AniList cast / demographic / sport / hobby / narrative
 *      -technical tags (male-protagonist, tennis, achronological-order, …)
 *   3. re-categorise tags that drifted; un-hide content-warning tags
 *   4. seed the curated `featured` set; recompute seriesCount
 *
 * Dry run:   npx tsx --env-file=.env scripts/tags-consolidate.mts --dry
 * Execute:   npx tsx --env-file=.env scripts/tags-consolidate.mts
 *
 * Idempotent — re-planned from current DB state each run. A backup of every
 * affected relation is written to scripts/.tag-consolidate-<ts>.json first.
 */
import { writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { TAG_DICTIONARY } from "@/lib/metadata/tag-dictionary";
import {
  canonicalTag,
  categorize,
  FEATURED_GENRE_SLUGS,
} from "@/lib/metadata/tag-canonical";
import { slugify } from "@/lib/metadata/tags";
import { recountTaxonomy } from "@/lib/metadata/importer";

const DRY = process.argv.includes("--dry");
const DICT = new Set(TAG_DICTIONARY.map((t) => slugify(t.name)));

async function main() {
  const tags = await db(() =>
    prisma.tag.findMany({
      select: { id: true, slug: true, name: true, category: true, hideFromDefault: true },
    }),
  );
  const bySlug = new Map(tags.map((t) => [t.slug, t]));

  type Merge = { from: (typeof tags)[number]; toSlug: string; toName: string; toCat: string };
  const merges: Merge[] = [];
  const purges: (typeof tags)[number][] = [];
  const handled = new Set<string>();

  for (const t of tags) {
    if (DICT.has(t.slug)) continue;
    const canon = canonicalTag(t.name); // allowNew: true
    if (!canon) {
      // stoplisted non-genre (cast / demo / sport / hobby / …) — delete it
      purges.push(t);
      handled.add(t.slug);
    } else if (canon.slug !== t.slug) {
      merges.push({ from: t, toSlug: canon.slug, toName: canon.name, toCat: canon.category });
      handled.add(t.slug);
    }
  }

  const recat: { slug: string; from: string; to: string }[] = [];
  for (const t of tags) {
    if (handled.has(t.slug)) continue;
    const want = categorize(t.name);
    if (want !== t.category) recat.push({ slug: t.slug, from: t.category, to: want });
  }

  const toUnhide = tags.filter((t) => t.hideFromDefault).length;

  console.log(`${merges.length} merges:`);
  for (const m of merges) console.log(`  ${m.from.slug.padEnd(24)} → ${m.toSlug}`);
  console.log(`\n${purges.length} purges:`);
  for (const p of purges) console.log(`  ✗ ${p.slug}`);
  console.log(`\n${recat.length} re-categorise, ${toUnhide} un-hide`);

  if (DRY) {
    console.log("\n--dry: nothing written.");
    await prisma.$disconnect();
    return;
  }

  // backup every relation we will touch
  const backup: Record<string, string[]> = {};
  for (const t of [...merges.map((m) => m.from), ...purges]) {
    const rows = await db(() =>
      prisma.$queryRaw<{ A: string }[]>(
        Prisma.sql`SELECT "A" FROM "_SeriesTags" WHERE "B" = ${t.id}`,
      ),
    );
    backup[t.slug] = rows.map((r) => r.A);
  }
  const file = `scripts/.tag-consolidate-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify({ backup }, null, 2));
  console.log(`\nbackup → ${file}\n`);

  // merges — 3 bulk statements each, retry-wrapped
  for (const m of merges) {
    const target =
      bySlug.get(m.toSlug) ??
      (await db(() =>
        prisma.tag.create({
          data: { slug: m.toSlug, name: m.toName, category: m.toCat as never },
          select: { id: true, slug: true, name: true, category: true, hideFromDefault: true },
        }),
      ));
    if (!bySlug.has(m.toSlug)) bySlug.set(m.toSlug, target);

    await db(() =>
      prisma.$executeRaw(Prisma.sql`
        INSERT INTO "_SeriesTags" ("A", "B")
        SELECT "A", ${target.id} FROM "_SeriesTags" WHERE "B" = ${m.from.id}
        ON CONFLICT ("A", "B") DO NOTHING
      `),
    );
    await db(() =>
      prisma.$executeRaw(Prisma.sql`DELETE FROM "_SeriesTags" WHERE "B" = ${m.from.id}`),
    );
    await db(() => prisma.tag.delete({ where: { id: m.from.id } }));
    console.log(`  ✓ ${m.from.slug} → ${m.toSlug} (${backup[m.from.slug]?.length ?? 0})`);
  }

  // purges — detach then delete
  for (const p of purges) {
    await db(() =>
      prisma.$executeRaw(Prisma.sql`DELETE FROM "_SeriesTags" WHERE "B" = ${p.id}`),
    );
    await db(() => prisma.tag.delete({ where: { id: p.id } }).catch(() => {}));
    console.log(`  ✗ purged ${p.slug} (${backup[p.slug]?.length ?? 0})`);
  }

  for (const r of recat) {
    await db(() =>
      prisma.tag.update({ where: { slug: r.slug }, data: { category: r.to as never } }),
    );
  }

  await db(() =>
    prisma.tag.updateMany({ where: { hideFromDefault: true }, data: { hideFromDefault: false } }),
  );
  await db(() =>
    prisma.tag.updateMany({
      where: { slug: { in: FEATURED_GENRE_SLUGS } },
      data: { featured: true },
    }),
  );

  await recountTaxonomy();

  const after = await db(() => prisma.tag.count());
  console.log(`\n✓ done. ${after} tags remain.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
