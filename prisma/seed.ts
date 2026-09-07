import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import slugify from "slugify";
import { TAG_DICTIONARY } from "../src/lib/metadata/tag-dictionary";

const prisma = new PrismaClient();
const slug = (s: string) => slugify(s, { lower: true, strict: true });

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !password || !url || !key) {
    console.log("• skipping admin (missing SEED_ADMIN_* / SUPABASE_* env)");
    return;
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // find or create the auth user
  const { data: list } = await sb.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.log("• admin auth user error:", error.message);
      return;
    }
    user = data.user!;
  }

  await prisma.profile.upsert({
    where: { id: user.id },
    update: { role: "ADMIN" },
    create: { id: user.id, handle: "admin", displayName: "Admin", role: "ADMIN" },
  });
  console.log(`✓ admin: ${email}`);
}

async function main() {
  for (const t of TAG_DICTIONARY) {
    const s = slug(t.name);
    await prisma.tag.upsert({
      where: { slug: s },
      update: { name: t.name, category: t.category, synonyms: t.synonyms ?? [] },
      create: {
        name: t.name,
        slug: s,
        category: t.category,
        synonyms: t.synonyms ?? [],
        hideFromDefault: t.category === "CONTENT_WARNING",
        coverUrl: t.landing ? `https://picsum.photos/seed/genre-${s}/600/240` : null,
        bodyMd: t.landing
          ? `${t.name} hentai — every ${t.name.toLowerCase()} title on the site, newest first. Replace this in /admin with a real intro paragraph.`
          : null,
      },
    });
  }
  console.log(`✓ ${TAG_DICTIONARY.length} tags`);

  await prisma.setting.upsert({
    where: { key: "site" },
    update: {},
    create: {
      key: "site",
      value: {
        name: "HentaiStream",
        tagline: "Watch hentai online — subbed, dubbed, uncensored",
        defaultOgImage: null,
        announcement: null,
        heroMode: "featuredRank",
        maintenance: false,
      },
    },
  });

  for (const [key, name, position] of [
    ["header", "Header leaderboard", "header"],
    ["below-player", "Below player", "watch"],
    ["between-comments", "Between comments", "watch"],
    ["sidebar", "Taxonomy sidebar", "taxonomy"],
    ["footer-sticky", "Mobile sticky footer", "global"],
    ["popunder", "Popunder", "global"],
  ] as const) {
    await prisma.adSlot.upsert({
      where: { key },
      update: {},
      create: { key, name, position, enabled: false, html: "" },
    });
  }
  console.log("✓ settings + ad slots");

  await seedAdmin();

  const studio = await prisma.studio.upsert({
    where: { slug: "sample-works" },
    update: {},
    create: {
      name: "Sample Works",
      slug: "sample-works",
      type: "STUDIO",
      description: "Placeholder studio for the demo catalogue.",
      bodyMd: "Replace in /admin with a real studio bio.",
      coverUrl: "https://picsum.photos/seed/studio-sample/1200/300",
    },
  });

  const pic = (seed: string, w: number, h: number) =>
    `https://picsum.photos/seed/${seed}/${w}/${h}`;

  const SYN =
    "Placeholder synopsis for design preview. When you add real series in /admin this text comes from the database. Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor.";

  await prisma.series.deleteMany({
    where: { slug: { in: ["demo-series", "sample-ongoing"] } },
  });

  type Demo = {
    slug: string;
    title: string;
    type: "OVA" | "ONA" | "MOVIE" | "SPECIAL" | "SERIES";
    status: "ONGOING" | "COMPLETED" | "HIATUS";
    year: number;
    tags: string[];
    episodes: number;
    banner: boolean;
    views: number;
    rating: number;
    ratings: number;
  };

  const demos: Demo[] = [
    { slug: "crimson-petals", title: "Crimson Petals", type: "OVA", status: "COMPLETED", year: 2025, tags: ["vanilla", "romance", "drama"], episodes: 4, banner: true, views: 9200, rating: 4.6, ratings: 210 },
    { slug: "after-class-lessons", title: "After Class Lessons", type: "SERIES", status: "ONGOING", year: 2026, tags: ["school", "comedy", "big-breasts"], episodes: 6, banner: true, views: 15400, rating: 4.2, ratings: 88 },
    { slug: "the-summoners-pact", title: "The Summoner's Pact", type: "OVA", status: "COMPLETED", year: 2024, tags: ["fantasy", "harem", "x-ray"], episodes: 3, banner: true, views: 22100, rating: 4.8, ratings: 512 },
    { slug: "office-hours", title: "Office Hours", type: "ONA", status: "COMPLETED", year: 2025, tags: ["milf", "femdom", "creampie"], episodes: 2, banner: false, views: 6100, rating: 3.9, ratings: 45 },
    { slug: "neighbours-secret", title: "Neighbour's Secret", type: "OVA", status: "ONGOING", year: 2026, tags: ["ntr", "drama", "milf"], episodes: 5, banner: true, views: 18700, rating: 4.1, ratings: 130 },
    { slug: "spring-festival", title: "Spring Festival", type: "SPECIAL", status: "COMPLETED", year: 2023, tags: ["vanilla", "romance", "comedy"], episodes: 1, banner: false, views: 3300, rating: 4.4, ratings: 61 },
    { slug: "guild-of-thorns", title: "Guild of Thorns", type: "SERIES", status: "ONGOING", year: 2026, tags: ["fantasy", "ahegao", "harem"], episodes: 8, banner: true, views: 27500, rating: 4.5, ratings: 340 },
    { slug: "roommates", title: "Roommates", type: "ONA", status: "COMPLETED", year: 2025, tags: ["school", "vanilla", "creampie"], episodes: 3, banner: false, views: 8800, rating: 4.0, ratings: 72 },
    { slug: "midnight-clinic", title: "Midnight Clinic", type: "OVA", status: "COMPLETED", year: 2024, tags: ["milf", "big-breasts", "x-ray"], episodes: 2, banner: false, views: 5400, rating: 3.7, ratings: 38 },
    { slug: "sunset-boulevard", title: "Sunset Boulevard", type: "MOVIE", status: "COMPLETED", year: 2022, tags: ["drama", "romance"], episodes: 1, banner: false, views: 4100, rating: 4.3, ratings: 55 },
  ];

  for (const d of demos) {
    const rating10 = Math.round(d.rating * 2); // 4.6/5 -> 9/10 scale
    const common = {
      coverUrl: pic(d.slug, 400, 600),
      bannerUrl: d.banner ? pic(`${d.slug}-b`, 1280, 500) : null,
      viewCount: d.views,
      weeklyViews: Math.round(d.views * 0.15),
      trendingScore: d.views * 0.15 + d.ratings,
      favoriteCount: Math.round(d.ratings * 0.6),
      ratingSum: rating10 * d.ratings,
      ratingAvg: rating10,
      ratingCount: d.ratings,
      bayesianRating: (rating10 * d.ratings + 7 * 25) / (d.ratings + 25),
    };
    const series = await prisma.series.upsert({
      where: { slug: d.slug },
      update: common,
      create: {
        slug: d.slug,
        title: d.title,
        titleRomaji: d.title,
        altTitles: [d.title.toUpperCase()],
        synopsis: SYN,
        type: d.type,
        status: d.status,
        year: d.year,
        animeSeason: "SUMMER",
        seasonYear: d.year,
        sourceMaterial: "ORIGINAL",
        totalEpisodes: d.status === "ONGOING" ? d.episodes + 2 : d.episodes,
        publish: "PUBLISHED",
        studioId: studio.id,
        tags: { connect: d.tags.map((t) => ({ slug: t })) },
        ...common,
      },
    });

    for (let n = 1; n <= d.episodes; n++) {
      const ep = await prisma.episode.upsert({
        where: { seriesId_number_part: { seriesId: series.id, number: n, part: 1 } },
        update: {},
        create: {
          seriesId: series.id,
          number: n,
          part: 1,
          title: `Episode ${n}`,
          runtimeSec: 1500,
          viewCount: Math.round(d.views / d.episodes),
          publish: "PUBLISHED",
        },
      });
      for (const host of ["STREAMTAPE", "DOODSTREAM"] as const) {
        const url = `https://${host === "STREAMTAPE" ? "streamtape.com" : "dood.to"}/e/DEMO${d.slug}${n}/`;
        await prisma.videoSource.upsert({
          where: {
            episodeId_host_embedUrl: { episodeId: ep.id, host, embedUrl: url },
          },
          update: {},
          create: {
            episodeId: ep.id,
            host,
            embedUrl: url,
            kind: "SUB",
            language: "en",
            quality: host === "STREAMTAPE" ? "Q1080" : "Q720",
            status: "ACTIVE",
          },
        });
      }
    }
  }
  console.log("✓ demo series + episodes + sources");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
