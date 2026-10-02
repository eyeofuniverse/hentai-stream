import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { putR2FromBuffer } from "@/lib/r2-upload";

const db = new PrismaClient();

const R2_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
// staged flat copies of the 12 needed files from the user's dropped-in
// "🔥🌶️2026 - NSFW Assets" folder (not committed long-term — see the repo
// note in scripts/_candyai_seed_assets/ once this has run successfully)
const ASSETS_DIR = join(process.cwd(), "scripts", "_candyai_seed_assets");

// Candy AI (AI girlfriend app) — real banner creative dropped into the repo
// by the user. No file→referral-link mapping was provided and the four
// 728x90s all read as generic "Create your AI Girlfriend" CTAs (confirmed by
// eye), so every image here routes to the same generic signup link rather
// than guessing a themed one (Goth/Solo/Boyfriend/etc).
const CANDY_LINK = "https://candyai.gg/characters/new?via=u771eo"; // "Create my AI"
const CANDY_ASSETS = {
  "728x90": [
    "b2h1_728x90_04_cmai.gif",
    "b3h1_728x90_06_cmai.gif",
    "b3h2_728x90_09_cmai.gif",
    "b3h3_728x90_08_cmai.gif",
  ],
  "300x100": [
    "300x100_banner_01.gif",
    "300x100_banner_02.gif",
    "300x100_banner_03.gif",
    "300x100_banner_04.gif",
    "300x100_banner_05.gif",
    "300x100_banner_06.gif",
    "300x100_banner_07.gif",
    "300x100_banner_08.gif",
  ],
  // No 970x250 creative exists in the delivered pack (no 900x250/970x250
  // folder at all) — home-footer and catalog-footer's desktop bands stay on
  // ExoClick until a matching size shows up.
};
const CANDY_TARGETS: { slot: string; device: "desktop" | "mobile"; size: keyof typeof CANDY_ASSETS }[] = [
  { slot: "home-mid", device: "desktop", size: "728x90" },
  { slot: "search-top", device: "desktop", size: "728x90" },
  { slot: "catalog-footer", device: "mobile", size: "300x100" },
];

function iframe(w: number, h: number, spotId: string): string {
  return `<iframe style="background-color: white;" width="${w}" height="${h}" scrolling="no" frameborder="0" allowtransparency="true" marginheight="0" marginwidth="0" name="spot_id_${spotId}" src="//a.adtng.com/get/${spotId}?ata=mail.minhajrahman"></iframe>`;
}

// Unique spot ids per size, deduped from the user's delivered creative list.
const PAYSITES = {
  "728x90": ["10008054", "10008050", "10008045", "10002481"],
  "300x250": ["10006955", "10005507", "10007972", "10008039", "10001807"],
  "900x250": ["10006954", "10008047", "10001815"],
};
const NUTAKU = {
  "728x90": ["10001811", "10002801"],
  "900x250": ["10001820", "10002800"],
  "300x100": ["10001817", "10002802"],
  "300x250": ["10001808", "10002808"],
  // 315x300 (10002798) held back — no designated slot fits that height
  // without the bottom getting clipped by the slot's overflow:hidden box.
};

type Target = { slot: string; device: "desktop" | "mobile"; size: string; program: "Paysites" | "Nutaku" };

const TARGETS: Target[] = [
  { slot: "watch-under-player", device: "desktop", size: "728x90", program: "Paysites" },
  { slot: "watch-in-content", device: "desktop", size: "728x90", program: "Paysites" },
  { slot: "watch-in-content", device: "mobile", size: "300x250", program: "Paysites" },
  { slot: "watch-footer", device: "desktop", size: "900x250", program: "Paysites" },

  { slot: "series-under-hero", device: "desktop", size: "728x90", program: "Nutaku" },
  { slot: "series-under-episodes", device: "desktop", size: "728x90", program: "Nutaku" },
  { slot: "series-footer", device: "desktop", size: "900x250", program: "Nutaku" },
  { slot: "series-footer", device: "mobile", size: "300x100", program: "Nutaku" },
  { slot: "catalog-sidebar", device: "desktop", size: "300x250", program: "Nutaku" },
];

async function seedCandyAi() {
  if (!R2_HOST) {
    console.log("NEXT_PUBLIC_R2_PUBLIC_HOST not set — skipping Candy AI upload");
    return;
  }
  // upload each unique local file once, reused across every target that size
  const urlCache = new Map<string, string[]>();
  for (const [size, files] of Object.entries(CANDY_ASSETS)) {
    const urls: string[] = [];
    for (const rel of files) {
      const buf = readFileSync(join(ASSETS_DIR, rel));
      const filename = rel.split("/").pop()!;
      const key = `ads/candyai/${filename}`;
      const ok = await putR2FromBuffer(key, buf, "image/gif");
      if (!ok) {
        console.error(`  FAILED to upload ${filename}`);
        continue;
      }
      urls.push(`https://${R2_HOST}/${key}`);
    }
    urlCache.set(size, urls);
    console.log(`Candy AI ${size}: uploaded ${urls.length}/${files.length}`);
  }

  for (const t of CANDY_TARGETS) {
    const urls = urlCache.get(t.size) ?? [];
    if (!urls.length) continue;
    await db.ad.deleteMany({ where: { slot: t.slot, deviceType: t.device } });
    await db.ad.createMany({
      data: urls.map((imageUrl, i) => ({
        slot: t.slot,
        deviceType: t.device,
        name: `${t.slot} — ${t.device} — Candy AI #${i + 1}`,
        type: "affiliate",
        imageUrl,
        linkUrl: CANDY_LINK,
        altText: "Candy AI — Create your AI Girlfriend",
        priority: 0,
        isActive: true,
      })),
    });
    console.log(`${t.slot} / ${t.device}: ${urls.length} Candy AI creatives`);
  }
}

async function main() {
  for (const t of TARGETS) {
    const [w, h] = t.size.split("x").map(Number);
    const pool = (t.program === "Paysites" ? PAYSITES : NUTAKU) as Record<string, string[]>;
    const spotIds = pool[t.size];

    await db.ad.deleteMany({ where: { slot: t.slot, deviceType: t.device } });
    await db.ad.createMany({
      data: spotIds.map((spotId, i) => ({
        slot: t.slot,
        deviceType: t.device,
        name: `${t.slot} — ${t.device} — ${t.program} #${i + 1} (${spotId})`,
        type: "network",
        networkCode: iframe(w, h, spotId),
        priority: 0,
        isActive: true,
      })),
    });
    console.log(`${t.slot} / ${t.device}: ${spotIds.length} ${t.program} creatives`);
  }
  await seedCandyAi();
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
