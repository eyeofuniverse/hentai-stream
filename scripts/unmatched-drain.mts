/**
 * Work the /admin/unmatched queue automatically: for every PENDING unmatched
 * title, run the full resolver again (catalogue → MAL search → bare-create a
 * DRAFT). Anything that resolves is marked MAPPED; the rest stays PENDING for a
 * human. A bare-created series is picked up by the next crawl of that site
 * (its raw title is now an alt-title), so its episodes ingest on their own.
 *
 *   npm run unmatched:drain              # up to 200 titles
 *   npm run unmatched:drain -- --limit=500
 *   npm run unmatched:drain -- --dry
 *
 * Safe to re-run. MAL search is rate-limited (~1 req/title).
 */
import { resolveOrImportSeries } from "@/lib/ingest";
import { prisma, db } from "@/lib/db";

const arg = (n: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const limit = Number(arg("limit")) || 200;
const dry = process.argv.includes("--dry");

const rows = await db(() =>
  prisma.unmatchedTitle.findMany({
    where: { status: "PENDING" },
    orderBy: [{ hits: "desc" }, { lastSeenAt: "desc" }],
    take: limit,
    select: { id: true, rawTitle: true, year: true },
  }),
);

console.log(`draining ${rows.length} PENDING unmatched titles${dry ? " (dry)" : ""}`);

let mapped = 0;
let created = 0;
let stillPending = 0;

for (const u of rows) {
  const r = await resolveOrImportSeries({
    title: u.rawTitle,
    year: u.year,
    create: !dry,
  }).catch(() => null);

  if (!r) {
    stillPending++;
    continue;
  }
  if (r.origin === "created") created++;
  mapped++;
  console.log(`  ✓ ${u.rawTitle} → ${r.origin} (${r.seriesId})`);

  if (!dry) {
    await db(() =>
      prisma.unmatchedTitle.update({
        where: { id: u.id },
        data: { status: "MAPPED", resolvedSeriesId: r.seriesId },
      }),
    ).catch(() => {});
  }
  // be nice to the MAL API
  await new Promise((res) => setTimeout(res, 350));
}

console.log(
  `\n── done ── mapped ${mapped} (of which ${created} new DRAFT), ${stillPending} still pending`,
);

await prisma.$disconnect();
