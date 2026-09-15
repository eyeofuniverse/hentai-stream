/**
 * Find and delete Bunny videos no episode references — orphans left by a
 * process kill mid-host — plus any still-failed video a DB-linked episode
 * points at.
 *
 *   npm run reconcile-bunny
 */
import { reconcileBunny } from "@/lib/hosting/reconcile";
import { bunnyEnabled } from "@/lib/hosting/bunny";
import { prisma } from "@/lib/db";

if (!bunnyEnabled()) {
  console.log("Bunny env not configured — skipping reconcile.");
  process.exit(0);
}

const s = await reconcileBunny({ log: (m) => console.log(m) });
console.log(JSON.stringify(s, null, 2));

await prisma.$disconnect();
process.exit(0);
