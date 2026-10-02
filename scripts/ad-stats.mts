import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// optional filter, e.g. `npx tsx scripts/ad-stats.mts "Candy AI"` — matches
// against the Ad.name column (set at seed/save time, e.g. "home-mid —
// desktop — Candy AI #1"); omit to list every active ad.
const filter = process.argv[2];

async function main() {
  const rows = await db.ad.findMany({
    where: { isActive: true, ...(filter ? { name: { contains: filter } } : {}) },
    select: { slot: true, deviceType: true, type: true, name: true, impressions: true, clicks: true },
    orderBy: [{ slot: "asc" }, { deviceType: "asc" }],
  });

  let totalImp = 0;
  let totalClicks = 0;
  for (const r of rows) {
    totalImp += r.impressions;
    totalClicks += r.clicks;
    const clickPart = r.type === "affiliate" ? `, ${r.clicks} clicks` : "";
    console.log(`${r.slot} / ${r.deviceType} — ${r.name}: ${r.impressions} impressions${clickPart}`);
  }
  console.log(
    `\nTOTAL (${rows.length} rows${filter ? ` matching "${filter}"` : ""}): ${totalImp} impressions, ${totalClicks} clicks`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
