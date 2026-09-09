/**
 * Enrich series metadata from an external source.
 *
 *   npm run enrich -- --source=anilist --limit=100 --dry-run
 *   npm run enrich -- --source=anilist
 *   npm run enrich -- --source=nhentai --limit=200
 *
 * Sources: anilist (tags, native/EN titles, description, characters, score),
 *          nhentai (granular tags, characters, parody, artist — Cloudflare-gated).
 * Non-destructive: only fills empty fields, only adds tags/characters.
 */
import { runEnrich } from "@/lib/enrich/run";
import { recountTaxonomy } from "@/lib/metadata/importer";
import { prisma } from "@/lib/db";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const hit = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return undefined;
  return hit.split("=")[1] ?? "true";
};

const source = flag("source");
if (!source) {
  console.error("--source is required (anilist | nhentai)");
  process.exit(1);
}

const summary = await runEnrich({
  source,
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  dryRun: !!flag("dry-run"),
  redo: !!flag("redo"),
  minGapMs: flag("gap") ? Number(flag("gap")) : undefined,
  log: (m) => console.log(m),
});

if (!flag("dry-run")) {
  await recountTaxonomy().catch((e) => console.error("recount:", e));
}

console.log("\n── done ──");
console.log(JSON.stringify(summary, null, 2));

await prisma.$disconnect();
process.exit(summary.errors.length ? 1 : 0);
