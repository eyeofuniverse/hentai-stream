/**
 * Re-host episodes whose only sources are dead hotlinks into Bunny.
 *
 * miohentai's CDN links are time-limited: a link that worked when scraped is a
 * dead HTML redirect a few days later (and there's no other host for ~77% of
 * those series). The only durable fix is to pull a FRESH link and have Bunny
 * fetch it right away, while it still works. So this works one series at a
 * time: scrape that series' fresh links → migrate exactly those episodes
 * immediately → move on. Runs until nothing is left or time runs out; the
 * targets are re-derived from the DB each run, so it's safe to re-run.
 *
 *   npm run rehost
 *   npm run rehost -- --max-minutes=60 --max-series=25
 */
import { prisma, db } from "@/lib/db";
import { Http } from "@/lib/scraper/http";
import { getAdapter } from "@/lib/scraper/sites";
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
        part: true,
        seriesId: true,
        series: { select: { title: true, titleEnglish: true, titleRomaji: true, bayesianRating: true } },
      },
      take: 6000,
    }),
  );
  const bySeries = new Map<string, typeof eps>();
  for (const e of eps) bySeries.set(e.seriesId, [...(bySeries.get(e.seriesId) ?? []), e]);
  return [...bySeries.values()].sort((a, b) => b[0].series.bayesianRating - a[0].series.bayesianRating);
}

async function main() {
  const adapter = getAdapter(SITE);
  const http = new Http(1500);
  const attempted = new Set<string>(); // don't retry a series that found nothing within one run
  let done = 0, queued = 0, noRefs = 0;

  while (Date.now() < deadline && done < maxSeries) {
    const list = (await targets()).filter((g) => !attempted.has(g[0].seriesId));
    if (!list.length) break;
    const group = list[0];
    const s = group[0].series;
    attempted.add(group[0].seriesId);
    done++;
    const q = s.titleEnglish || s.title || s.titleRomaji || "";
    log(`\n[${done}] ${s.title} — ${group.length} episode(s) to re-host (${list.length - 1} more series waiting)`);

    try {
      const refs = await adapter.findRefsByTitle(http, q);
      const need = new Map(group.map((e) => [e.number, e]));
      const names = [...new Set([s.title, s.titleEnglish, s.titleRomaji].filter(Boolean).map((t) => normalizeTitle(t as string)))];
      const ids: string[] = [];
      for (const ref of refs) {
        const e = need.get(ref.number);
        if (!e) continue;
        const rt = normalizeTitle(ref.seriesTitle);
        if (!names.some((n) => n === rt || jaccard(tok(n), tok(rt)) >= 0.8)) continue; // a different series' post
        const srcs = ref.sources?.length ? ref.sources : await adapter.fetchSources(http, ref).catch(() => []);
        if (!srcs.length) continue;
        const res = await ingestEpisode({
          seriesId: e.seriesId,
          number: ref.number,
          part: ref.part,
          site: SITE,
          publishLive: false,
          sources: srcs.map((src) => ({
            hostOrUrl: src.hostOrUrl,
            embedUrl: src.embedUrl,
            kind: src.kind,
            language: src.language,
            quality: normQuality(src.quality) as never,
            isCensored: src.isCensored ?? null,
            direct: src.direct,
          })),
        });
        ids.push(res.episodeId);
      }
      if (!ids.length) {
        noRefs++;
        log("  · no fresh link found on the source site");
        continue;
      }
      // host them NOW — the fresh links are only good for a limited time
      const m = await runMigrate({ episodeIds: ids, limit: ids.length + 2, retry: true, log });
      queued += m.queued;
      log(`  → queued ${m.queued}/${ids.length}${m.errors.length ? ` | errors: ${m.errors.slice(0, 2).join("; ")}` : ""}`);
    } catch (e) {
      log(`  ! ${(e as Error).message}`);
    }

    if (done % 15 === 0) await pollHosting({ log }).catch(() => {});
  }

  await new Promise((r) => setTimeout(r, 5000));
  const p = await pollHosting({ log }).catch(() => null);
  console.log(`\n── rehost done: ${done} series tried, ${queued} episodes queued into Bunny, ${noRefs} series had no fresh link ──`);
  if (p) console.log("poll:", JSON.stringify(p));
  await prisma.$disconnect();
  process.exit(0);
}

main();
