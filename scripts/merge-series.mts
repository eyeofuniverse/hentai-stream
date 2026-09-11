/**
 * Merge a duplicate Series into its canonical copy — same content imported
 * twice under different title spellings (common with a 5-source scraper).
 * Moves episodes/sources/engagement onto the canonical row, leaves a 301
 * redirect behind for every URL the loser used to serve, then removes the
 * loser. Safe to re-run — a pair already merged is a no-op (loser is gone).
 *
 *   npx tsx --env-file=.env scripts/merge-series.mts --loser=<slug> --canonical=<slug> [--dry-run]
 *   npx tsx --env-file=.env scripts/merge-series.mts --file=pairs.json [--dry-run]
 *     pairs.json: [["loser-slug", "canonical-slug"], ...]
 */
import { readFileSync } from "node:fs";
import { prisma, db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const hit = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return hit ? (hit.split("=")[1] ?? "true") : undefined;
};
const dryRun = !!flag("dry-run");

let pairs: [string, string][] = [];
if (flag("file")) {
  pairs = JSON.parse(readFileSync(flag("file")!, "utf8"));
} else {
  const loser = flag("loser");
  const canonical = flag("canonical");
  if (!loser || !canonical) {
    console.error("need --loser=<slug> --canonical=<slug>, or --file=pairs.json");
    process.exit(1);
  }
  pairs = [[loser, canonical]];
}

type Tx = Prisma.TransactionClient;

async function mergeOne(loserSlug: string, canonicalSlug: string) {
  if (loserSlug === canonicalSlug) {
    console.log(`= ${loserSlug} — same slug, skipping`);
    return;
  }

  let [loser, canon] = await Promise.all([
    db(() => prisma.series.findUnique({ where: { slug: loserSlug }, include: { tags: true, characters: true, episodes: true } })),
    db(() => prisma.series.findUnique({ where: { slug: canonicalSlug }, include: { tags: true, characters: true, episodes: true } })),
  ]);
  if (!loser) { console.log(`? ${loserSlug} — not found (already merged?)`); return; }
  if (!canon) { console.log(`? ${canonicalSlug} — canonical not found`); return; }

  // a live PUBLISHED page must never lose out to a DRAFT one, whichever way
  // the caller named them — the DRAFT side has no indexed traffic to protect
  if (loser.publish === "PUBLISHED" && canon.publish !== "PUBLISHED") {
    console.log(`  (swapping — "${loserSlug}" is PUBLISHED, "${canonicalSlug}" is ${canon.publish})`);
    [loser, canon] = [canon, loser];
  }

  console.log(`\n── ${loser.title} (${loser.slug}) → ${canon.title} (${canon.slug}) ──`);
  if (dryRun) {
    console.log(`  [dry-run] would move ${loser.episodes.length} episode(s), tags=${loser.tags.length}, chars=${loser.characters.length}`);
    return;
  }

  await db(() =>
    prisma.$transaction(async (tx: Tx) => {
      // altTitles — record the loser's title so the next scrape/enrich pass
      // resolves straight to the canonical row instead of recreating this dup
      const extraAlt = [loser.title, ...loser.altTitles].filter(
        (t) => t !== canon.title && !canon.title.includes(t),
      );
      if (extraAlt.length) {
        const merged = [...new Set([...(await tx.series.findUniqueOrThrow({ where: { id: canon.id }, select: { altTitles: true } })).altTitles, ...extraAlt])];
        await tx.series.update({ where: { id: canon.id }, data: { altTitles: merged } });
      }

      // tags / characters — union onto canonical (implicit m2m, safe to
      // re-connect what's already there)
      if (loser.tags.length) {
        await tx.series.update({
          where: { id: canon.id },
          data: { tags: { connect: loser.tags.map((t) => ({ id: t.id })) } },
        });
      }
      if (loser.characters.length) {
        await tx.series.update({
          where: { id: canon.id },
          data: { characters: { connect: loser.characters.map((c) => ({ id: c.id })) } },
        });
      }

      // episodes
      for (const le of loser.episodes) {
        const ce = canon.episodes.find((e) => e.number === le.number && e.part === le.part);
        if (!ce) {
          // canonical has no episode at this number — just move the whole row
          await tx.episode.update({ where: { id: le.id }, data: { seriesId: canon.id } });
          continue;
        }

        // canonical already has this episode — fold the loser's copy into it
        const [sources, downloads, progress, ratings, stats] = await Promise.all([
          tx.videoSource.findMany({ where: { episodeId: le.id } }),
          tx.downloadLink.findMany({ where: { episodeId: le.id } }),
          tx.watchProgress.findMany({ where: { episodeId: le.id } }),
          tx.rating.findMany({ where: { episodeId: le.id } }),
          tx.episodeDailyStat.findMany({ where: { episodeId: le.id } }),
        ]);

        for (const s of sources) {
          await tx.videoSource
            .update({ where: { id: s.id }, data: { episodeId: ce.id } })
            .catch(() => tx.videoSource.delete({ where: { id: s.id } })); // dup (episodeId,host,embedUrl)
        }
        for (const d of downloads) {
          await tx.downloadLink
            .update({ where: { id: d.id }, data: { episodeId: ce.id } })
            .catch(() => tx.downloadLink.delete({ where: { id: d.id } }));
        }
        for (const p of progress) {
          const existing = await tx.watchProgress.findUnique({
            where: { profileId_episodeId: { profileId: p.profileId, episodeId: ce.id } },
          });
          if (existing) {
            if (p.completed && !existing.completed) {
              await tx.watchProgress.update({
                where: { profileId_episodeId: { profileId: p.profileId, episodeId: ce.id } },
                data: { completed: true, lastWatchedAt: p.lastWatchedAt > existing.lastWatchedAt ? p.lastWatchedAt : existing.lastWatchedAt },
              });
            }
          } else {
            await tx.watchProgress.create({
              data: { profileId: p.profileId, episodeId: ce.id, completed: p.completed, lastWatchedAt: p.lastWatchedAt },
            });
          }
        }
        for (const r of ratings) {
          const existing = await tx.rating.findUnique({
            where: { profileId_episodeId: { profileId: r.profileId, episodeId: ce.id } },
          });
          if (!existing) {
            await tx.rating.update({ where: { id: r.id }, data: { episodeId: ce.id } });
          } // else: canonical already has this user's rating — drop the loser's
        }
        for (const s of stats) {
          const existing = await tx.episodeDailyStat.findUnique({
            where: { episodeId_date: { episodeId: ce.id, date: s.date } },
          });
          if (existing) {
            await tx.episodeDailyStat.update({
              where: { episodeId_date: { episodeId: ce.id, date: s.date } },
              data: { views: existing.views + s.views, uniques: existing.uniques + s.uniques },
            });
          } else {
            await tx.episodeDailyStat.create({
              data: { episodeId: ce.id, date: s.date, views: s.views, uniques: s.uniques },
            });
          }
        }

        // comments pointed at the loser episode now point at the canonical one
        await tx.comment.updateMany({
          where: { targetType: "episode", targetId: le.id },
          data: { targetId: ce.id },
        });

        await tx.episode.delete({ where: { id: le.id } });
        await tx.redirectMap.upsert({
          where: { fromPath: `/hentai/${loser.slug}/${le.number}` },
          create: { fromPath: `/hentai/${loser.slug}/${le.number}`, toPath: `/hentai/${canon.slug}/${ce.number}` },
          update: { toPath: `/hentai/${canon.slug}/${ce.number}` },
        });
      }

      // any episode moved (not folded) needs its own redirect too, since the
      // URL's slug segment changed even though the episode id didn't
      for (const le of loser.episodes) {
        const stillLoserOwned = !canon.episodes.some((e) => e.number === le.number && e.part === le.part);
        if (stillLoserOwned) {
          await tx.redirectMap.upsert({
            where: { fromPath: `/hentai/${loser.slug}/${le.number}` },
            create: { fromPath: `/hentai/${loser.slug}/${le.number}`, toPath: `/hentai/${canon.slug}/${le.number}` },
            update: { toPath: `/hentai/${canon.slug}/${le.number}` },
          });
        }
      }

      // series-level watchlist entries
      const listEntries = await tx.listEntry.findMany({ where: { seriesId: loser.id } });
      for (const le of listEntries) {
        const existing = await tx.listEntry.findUnique({
          where: { profileId_seriesId: { profileId: le.profileId, seriesId: canon.id } },
        });
        if (!existing) {
          await tx.listEntry.create({
            data: { profileId: le.profileId, seriesId: canon.id, status: le.status, createdAt: le.createdAt },
          });
        }
        await tx.listEntry.delete({ where: { profileId_seriesId: { profileId: le.profileId, seriesId: loser.id } } });
      }

      // series-level ratings — fold in, then recompute canonical's aggregate
      const seriesRatings = await tx.rating.findMany({ where: { seriesId: loser.id } });
      for (const r of seriesRatings) {
        const existing = await tx.rating.findUnique({
          where: { profileId_seriesId: { profileId: r.profileId, seriesId: canon.id } },
        });
        if (!existing) {
          await tx.rating.update({ where: { id: r.id }, data: { seriesId: canon.id } });
        } else {
          await tx.rating.delete({ where: { id: r.id } });
        }
      }
      const agg = await tx.rating.aggregate({
        where: { seriesId: canon.id },
        _sum: { value: true },
        _count: { value: true },
      });
      const ratingCount = agg._count.value;
      const ratingSum = agg._sum.value ?? 0;
      await tx.series.update({
        where: { id: canon.id },
        data: {
          ratingCount,
          ratingSum,
          ratingAvg: ratingCount ? ratingSum / ratingCount : 0,
          viewCount: { increment: loser.viewCount },
          favoriteCount: { increment: loser.favoriteCount },
        },
      });

      // series-level comments
      await tx.comment.updateMany({
        where: { targetType: "series", targetId: loser.id },
        data: { targetId: canon.id },
      });

      await tx.series.delete({ where: { id: loser.id } });

      // backfill any metadata the canonical row is missing from the loser
      // (anilistId etc. only movable now that the loser's row, and its claim
      // on the unique constraint, is gone)
      if (canon.metadataSource !== "manual") {
        const fillData: Record<string, unknown> = {};
        const fill = (key: keyof typeof loser, empty: boolean) => {
          const v = loser[key];
          if (v != null && v !== "" && empty) fillData[key] = v;
        };
        fill("synopsis", !canon.synopsis);
        fill("titleEnglish", !canon.titleEnglish);
        fill("titleOriginal", !canon.titleOriginal);
        fill("titleRomaji", !canon.titleRomaji);
        fill("coverUrl", !canon.coverUrl);
        fill("bannerUrl", !canon.bannerUrl);
        fill("externalScore", canon.externalScore == null);
        fill("year", canon.year == null);
        fill("artist", !canon.artist);
        fill("parody", !canon.parody);
        fill("anilistId", canon.anilistId == null);
        fill("malId", canon.malId == null);
        fill("nhentaiId", canon.nhentaiId == null);
        fill("hanimeSlug", !canon.hanimeSlug);
        fill("anidbId", canon.anidbId == null);
        fill("studioId", !canon.studioId);
        if (Object.keys(fillData).length) {
          await tx.series.update({ where: { id: canon.id }, data: fillData });
        }
      }

      await tx.redirectMap.upsert({
        where: { fromPath: `/hentai/${loser.slug}` },
        create: { fromPath: `/hentai/${loser.slug}`, toPath: `/hentai/${canon.slug}` },
        update: { toPath: `/hentai/${canon.slug}` },
      });
    }, { timeout: 90000 }),
  );

  console.log(`  ✓ merged — /hentai/${loser.slug} → /hentai/${canon.slug}`);
}

for (const [loserSlug, canonicalSlug] of pairs) {
  try {
    await mergeOne(loserSlug, canonicalSlug);
  } catch (e) {
    console.error(`✗ ${loserSlug} → ${canonicalSlug}: ${(e as Error).message}`);
  }
}

await prisma.$disconnect();
