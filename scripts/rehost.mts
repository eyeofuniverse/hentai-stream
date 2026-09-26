/**
 * Re-host episodes whose only source is miohentai into Bunny.
 *
 * miohentai's CDN links are time-limited: a link that worked when scraped is a
 * dead HTML redirect a few days later (and there's no other host for ~77% of
 * those series). The only durable fix is to pull a FRESH link and have Bunny
 * fetch it right away, while it still works.
 *
 * miohentai's own search is useless for this (it returns nothing for titles
 * that exist), so this works from its post sitemap instead: match every post
 * to our unhosted series by name, then for each matching post — best-rated
 * series first — fetch the page (fresh link), ingest it, and migrate exactly
 * that episode immediately. Targets are re-derived from the DB each run, so
 * it's safe to re-run.
 *
 *   npm run rehost
 *   npm run rehost -- --max-minutes=60 --max-series=25
 */
import { prisma, db } from "@/lib/db";
import { Http, sitemapLocs } from "@/lib/scraper/http";
import { parsePost } from "@/lib/scraper/sites/miohentai";
import { normQuality } from "@/lib/scraper/types";
import { ingestEpisode, normalizeTitle } from "@/lib/ingest";
import { bunnyEnabled } from "@/lib/hosting/bunny";
import { runMigrate, pollHosting } from "@/lib/hosting/migrate";

if (!bunnyEnabled()) {
  console.log("Bunny env not configured — skipping rehost.");
  process.exit(0);
}

const args = process.argv.slice(2);
const flag = (n: string) => {
  const h = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return h ? (h.split("=")[1] ?? "true") : undefined;
};
const deadline = Date.now() + Number(flag("max-minutes") ?? 300) * 60_000;
const maxSeries = Number(flag("max-series") ?? 100000);
const SITE = "miohentai";
const BASE = "https://miohentai.com";
const log = (m: string) => console.log(m);

const tok = (s: string) => new Set(s.split(" ").filter((t) => t.length > 1));
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

async function targets() {
  // unhosted real episodes whose ONLY usable source is miohentai. Its links
  // expire, so whatever we have stored is presumed stale whether or not verify
  // has flagged it DEAD yet — this must not wait on a verify pass.
  const eps = await db(() =>
    prisma.episode.findMany({
      where: {
        kind: "MAIN",
        bunnyGuid: null,
        sources: {
          some: { sourceSite: SITE },
          // no other host has a copy Bunny could pull
          none: { sourceSite: { not: SITE }, direct: true, status: { not: "DEAD" } },
        },
      },
      select: {
        id: true,
        number: true,
        seriesId: true,
        series: { select: { title: true, titleEnglish: true, titleRomaji: true, slug: true, altTitles: true, bayesianRating: true } },
      },
      take: 6000,
    }),
  );
  const bySeries = new Map<string, typeof eps>();
  for (const e of eps) bySeries.set(e.seriesId, [...(bySeries.get(e.seriesId) ?? []), e]);
  return [...bySeries.values()].sort((a, b) => b[0].series.bayesianRating - a[0].series.bayesianRating);
}

async function postUrls(http: Http): Promise<string[]> {
  const urls: string[] = [];
  for (const sm of ["post-sitemap.xml", "post-sitemap2.xml", "post-sitemap3.xml", "post-sitemap4.xml"]) {
    const xml = await http.getMaybe(`${BASE}/${sm}`);
    if (!xml) continue;
    for (const u of sitemapLocs(xml)) if (/^https:\/\/miohentai\.com\/[a-z0-9-]+\/$/i.test(u)) urls.push(u);
  }
  return urls;
}

async function main() {
  const http = new Http(1500);
  const groups = await targets();
  console.log(`${groups.length} series need re-hosting (${groups.reduce((n, g) => n + g.length, 0)} episodes)`);
  if (!groups.length) return finish(0, 0, 0);

  const nameSets = groups.map((g) => {
    const s = g[0].series;
    const raw = [s.title, s.titleEnglish, s.titleRomaji, s.slug.replace(/-/g, " "), ...s.altTitles.slice(0, 4)].filter(Boolean) as string[];
    return [...new Set(raw.map((t) => normalizeTitle(t)))].filter((t) => t.length >= 3).map((t) => ({ t, k: tok(t) }));
  });
  const exact = new Map<string, number>();
  nameSets.forEach((ns, i) => ns.forEach((n) => exact.set(n.t, i)));

  // match every miohentai post to a series by its slug
  const urls = await postUrls(http);
  const posts = new Map<number, string[]>();
  for (const u of urls) {
    const slug = u.replace(BASE + "/", "").replace(/\/$/, "");
    const pn = normalizeTitle(slug.replace(/-/g, " "));
    let gi = exact.get(pn);
    if (gi === undefined) {
      const pk = tok(pn);
      let best = 0;
      nameSets.forEach((ns, i) => ns.forEach((n) => { const j = jaccard(pk, n.k); if (j >= 0.85 && j > best) { best = j; gi = i; } }));
    }
    if (gi !== undefined) posts.set(gi, [...(posts.get(gi) ?? []), u]);
  }
  console.log(`${urls.length} miohentai posts indexed; ${posts.size} of ${groups.length} target series have a matching post`);

  let done = 0, queued = 0, skipped = 0;
  for (let gi = 0; gi < groups.length && Date.now() < deadline && done < maxSeries; gi++) {
    const list = posts.get(gi);
    if (!list) continue;
    const group = groups[gi];
    const s = group[0].series;
    done++;
    const need = new Map(group.map((e) => [e.number, e]));
    log(`\n[${done}] ${s.title} — need episode(s) ${[...need.keys()].join(",")} — ${list.length} candidate post(s)`);

    for (const url of list) {
      try {
        const page = await http.getMaybe(url);
        const ref = page ? parsePost(page, url) : null;
        if (!ref) { log(`  · ${url.replace(BASE, "")}: no playable video on the page`); continue; }
        const e = need.get(ref.number);
        if (!e) { log(`  · ${url.replace(BASE, "")}: is episode ${ref.number}, not one we need`); skipped++; continue; }
        const res = await ingestEpisode({
          seriesId: e.seriesId,
          number: ref.number,
          part: ref.part,
          site: SITE,
          publishLive: false,
          sources: ref.sources!.map((src) => ({
            hostOrUrl: src.hostOrUrl,
            embedUrl: src.embedUrl,
            kind: src.kind,
            language: src.language,
            quality: normQuality(src.quality) as never,
            isCensored: src.isCensored ?? null,
            direct: src.direct,
          })),
        });
        // host it NOW — the fresh link is only good for a limited time
        const m = await runMigrate({ episodeIds: [res.episodeId], limit: 3, retry: true, gapMs: 8000, log });
        queued += m.queued;
        need.delete(ref.number);
        log(`  → episode ${ref.number}: queued ${m.queued}/1${m.errors.length ? ` | ${m.errors[0]}` : ""}`);
      } catch (err) {
        log(`  ! ${(err as Error).message}`);
      }
    }
    if (done % 15 === 0) await pollHosting({ log }).catch(() => {});
  }
  await finish(done, queued, skipped);
}

async function finish(done: number, queued: number, skipped: number) {
  await new Promise((r) => setTimeout(r, 5000));
  const p = await pollHosting({ log }).catch(() => null);
  console.log(`\n── rehost done: ${done} series worked, ${queued} episodes queued into Bunny, ${skipped} posts skipped ──`);
  if (p) console.log("poll:", JSON.stringify(p));
  await prisma.$disconnect();
  process.exit(0);
}

main();
