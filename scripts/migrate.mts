/**
 * Queue episodes into Bunny Stream, then poll for the ones that finished.
 *
 *   npm run migrate                      # queue all un-hosted episodes, then poll
 *   npm run migrate -- --limit=100
 *   npm run migrate -- --site=hentaigasm
 *   npm run migrate -- --retry           # also re-queue failed ones
 *   npm run migrate -- --poll-only       # just check in-flight transcodes
 */
import { runMigrate, pollHosting } from "@/lib/hosting/migrate";
import { bunnyEnabled } from "@/lib/hosting/bunny";
import { prisma } from "@/lib/db";

if (!bunnyEnabled()) {
  console.log("Bunny env not configured — skipping migrate.");
  process.exit(0);
}

const args = process.argv.slice(2);
const flag = (n: string) => {
  const h = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return h ? (h.split("=")[1] ?? "true") : undefined;
};

if (!flag("poll-only")) {
  const s = await runMigrate({
    limit: flag("limit") ? Number(flag("limit")) : undefined,
    retry: !!flag("retry"),
    site: flag("site"),
    gapMs: flag("gap") ? Number(flag("gap")) : undefined,
    log: (m) => console.log(m),
  });
  console.log("\n── queued ──");
  console.log(JSON.stringify(s, null, 2));
}

// give the fast ones a head start, then poll
await new Promise((r) => setTimeout(r, 5000));
const p = await pollHosting({ log: (m) => console.log(m) });
console.log("\n── poll ──");
console.log(JSON.stringify(p, null, 2));

await prisma.$disconnect();
process.exit(0);
