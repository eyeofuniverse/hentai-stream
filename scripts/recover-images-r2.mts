/**
 * EMERGENCY RECOVERY (2026-09-12): Cloudinary disabled account-wide image
 * delivery for this site (ACL deny on every asset, export/archive disabled
 * too — no way to pull the actual bytes back out). Every Series.coverUrl /
 * bannerUrl that doesn't start with "http" is a now-dead Cloudinary key.
 *
 * Since the DB already stores the exact key string ("series/covers/<slug>")
 * and only the *bytes behind it* are gone, this re-derives a fresh source
 * image from AniList/MAL (using the anilistId/malId already on the row —
 * stable, independent of Cloudinary) and re-populates that SAME key in R2.
 * No DB writes needed — cloudinary.ts already points at R2 for delivery.
 *
 *   npx tsx --env-file=.env scripts/recover-images-r2.mts [--limit=N]
 */
import { prisma, db } from "@/lib/db";
import { Http } from "@/lib/scraper/http";
import { getAnime } from "@/lib/metadata/mal";
import { putR2FromUrl } from "@/lib/r2-upload";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const targets = await db(() =>
  prisma.series.findMany({
    where: {
      OR: [
        { AND: [{ coverUrl: { not: null } }, { NOT: { coverUrl: { startsWith: "http" } } }] },
        { AND: [{ bannerUrl: { not: null } }, { NOT: { bannerUrl: { startsWith: "http" } } }] },
      ],
    },
    orderBy: [{ publish: "asc" }, { updatedAt: "desc" }], // PUBLISHED sorts before DRAFT
    take: limit,
    select: { id: true, slug: true, title: true, publish: true, coverUrl: true, bannerUrl: true, anilistId: true, malId: true },
  }),
);
console.log(`${targets.length} series need image recovery (${targets.filter((t) => t.publish === "PUBLISHED").length} published)`);

const http = new Http(1300); // AniList
let coverOk = 0, coverFail = 0, bannerOk = 0, bannerFail = 0, noSource = 0;

const MEDIA = `query ($v: Int) { Media(id: $v, type: ANIME) { coverImage { extraLarge large } bannerImage } }`;

for (const [i, t] of targets.entries()) {
  let cover: string | null = null;
  let banner: string | null = null;

  try {
    if (t.anilistId) {
      const r = await http.postJson<{ data?: { Media?: { coverImage?: { extraLarge?: string; large?: string }; bannerImage?: string } } }>(
        "https://graphql.anilist.co",
        { query: MEDIA, variables: { v: t.anilistId } },
        { origin: "https://anilist.co", referer: "https://anilist.co/" },
      );
      const m = r.data?.Media;
      cover = m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? null;
      banner = m?.bannerImage ?? null;
    } else if (t.malId) {
      const a = await getAnime(t.malId);
      cover = a.main_picture?.large ?? a.main_picture?.medium ?? null;
      await new Promise((r) => setTimeout(r, 400)); // be polite, no built-in throttle in malGet
    }
  } catch (e) {
    console.log(`[${i + 1}/${targets.length}] ✗ ${t.title} — lookup failed: ${(e as Error).message}`);
    continue;
  }

  if (!cover && !banner) {
    noSource++;
    console.log(`[${i + 1}/${targets.length}] ? ${t.title} — no anilistId/malId or source has no image`);
    continue;
  }

  let coverMsg = "";
  if (t.coverUrl && !t.coverUrl.startsWith("http")) {
    if (cover) {
      const ok = await putR2FromUrl(t.coverUrl, cover);
      if (ok) coverOk++; else coverFail++;
      coverMsg = ok ? "cover✓" : "cover✗";
    } else {
      coverMsg = "cover:no-source";
    }
  }

  let bannerMsg = "";
  if (t.bannerUrl && !t.bannerUrl.startsWith("http")) {
    if (banner) {
      const ok = await putR2FromUrl(t.bannerUrl, banner);
      if (ok) bannerOk++; else bannerFail++;
      bannerMsg = ok ? "banner✓" : "banner✗";
    } else {
      bannerMsg = "banner:no-source";
    }
  }

  console.log(`[${i + 1}/${targets.length}] ${t.title} — ${[coverMsg, bannerMsg].filter(Boolean).join(" ")}`);
}

console.log("\n── done ──");
console.log(JSON.stringify({ total: targets.length, coverOk, coverFail, bannerOk, bannerFail, noSource }, null, 2));
await prisma.$disconnect();
