/**
 * Flip Series.isCensored -> false for titles we can positively tell are
 * uncensored, using the only trustworthy local signal: a scraped VideoSource
 * that a source adapter marked isCensored === false from a real "uncensored"
 * badge (hentaigasm does this; watchhentai's old rows guessed from the URL and
 * are NOT trusted here).
 *
 *   npm run backfill:censored            # apply
 *   npm run backfill:censored -- --dry   # count only
 *
 * Safe to re-run. Every DB call retries transient pooler errors (src/lib/db.ts).
 */
import { prisma, db } from "@/lib/db";

const dry = process.argv.includes("--dry");

// adapters whose isCensored === false is a positive read, not a default
const TRUSTED_UNCENSORED_SITES = ["hentaigasm"];

async function main() {
  const uncensored = await db(() =>
    prisma.series.findMany({
      where: {
        isCensored: true, // only touch the ones still defaulted
        episodes: {
          some: {
            sources: {
              some: {
                isCensored: false,
                sourceSite: { in: TRUSTED_UNCENSORED_SITES },
              },
            },
          },
        },
      },
      select: { id: true, slug: true, title: true },
    }),
  );

  console.log(`${uncensored.length} series look uncensored (trusted signal).`);
  for (const s of uncensored.slice(0, 20)) console.log(`  · ${s.title}`);
  if (uncensored.length > 20) console.log(`  … +${uncensored.length - 20} more`);

  if (dry) {
    console.log("\n--dry: nothing written.");
    return;
  }

  const ids = uncensored.map((s) => s.id);
  const res = await db(() =>
    prisma.series.updateMany({
      where: { id: { in: ids } },
      data: { isCensored: false },
    }),
  );
  console.log(`\nUpdated ${res.count} series -> isCensored: false`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
