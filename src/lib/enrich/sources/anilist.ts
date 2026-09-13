import type { Http } from "@/lib/scraper/http";
import { normalizeTitle } from "@/lib/ingest";
import type { Enricher, EnrichResult, EnrichCharacter, SeriesForEnrich } from "../types";

const API = "https://graphql.anilist.co";

const MEDIA = `
id idMal
title { romaji english native }
synonyms
description(asHtml: false)
seasonYear
startDate { year month day }
averageScore
coverImage { extraLarge large }
bannerImage
isAdult
studios(isMain: true) { nodes { name } }
tags { name rank isGeneralSpoiler }
characters(sort: [ROLE, RELEVANCE], perPage: 20) { nodes { name { full } image { large } description(asHtml: false) } }
`;

interface AniMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  description: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  averageScore: number | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  isAdult: boolean;
  studios: { nodes: { name: string }[] };
  tags: { name: string; rank: number; isGeneralSpoiler: boolean }[];
  characters: {
    nodes: {
      name: { full: string | null };
      image: { large: string | null } | null;
      description: string | null;
    }[];
  };
}

async function query(
  http: Http,
  vars: Record<string, unknown>,
  by: "id" | "idMal" | "search",
): Promise<AniMedia | null> {
  const arg =
    by === "id" ? "id: $v" : by === "idMal" ? "idMal: $v" : "search: $v";
  const type = by === "search" ? "String" : "Int";
  const q = `query ($v: ${type}) { Media(${arg}, type: ANIME) { ${MEDIA} } }`;
  // AniList answers a genuine "not found" with HTTP 404 — that's a null, not an
  // error. A 403 (WAF) / 429 / 5xx is a real transport problem and propagates so
  // the run records it instead of silently reporting "no match" everywhere.
  try {
    const r = await http.postJson<{
      data?: { Media?: AniMedia | null };
      errors?: { message: string }[];
    }>(
      API,
      { query: q, variables: { v: vars.v } },
      // AniList's WAF 403s requests without a browser Origin/Referer
      { origin: "https://anilist.co", referer: "https://anilist.co/" },
    );
    return r.data?.Media ?? null;
  } catch (e) {
    if (/→ 404$/.test((e as Error).message)) return null;
    throw e;
  }
}

/** AniList gives year/month/day separately and sometimes only part of it
 *  (e.g. year-only for an unannounced-day release) — only build a real Date
 *  out of a full y/m/d triple, same standard as the MAL side. */
function fullDate(d: AniMedia["startDate"]): Date | null {
  if (!d?.year || !d.month || !d.day) return null;
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return (
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      // AniList markdown wraps spoiler text in ~! !~ — drop the markers, keep the text
      .replace(/~!|!~/g, "")
      .trim() || null
  );
}

function toResult(m: AniMedia): EnrichResult {
  const desc = stripHtml(m.description);
  return {
    matched: true,
    externalId: m.id,
    series: {
      titleEnglish: m.title.english,
      titleRomaji: m.title.romaji,
      titleOriginal: m.title.native,
      synopsis: desc,
      coverUrl: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
      bannerUrl: m.bannerImage,
      externalScore: m.averageScore != null ? m.averageScore / 10 : null,
      year: m.seasonYear,
      releaseDate: fullDate(m.startDate),
      isCensored: null, // AniList doesn't track this
      studioName: m.studios.nodes[0]?.name ?? null,
    },
    tags: m.tags
      .filter((t) => !t.isGeneralSpoiler && t.rank >= 25)
      .map((t) => t.name),
    characters: m.characters.nodes
      .filter((c): c is typeof c & { name: { full: string } } => !!c.name.full)
      .map(
        (c): EnrichCharacter => ({
          name: c.name.full,
          imageUrl: c.image?.large ?? null,
          description: stripHtml(c.description)?.slice(0, 1000) ?? null,
        }),
      ),
  };
}

export const anilist: Enricher = {
  name: "anilist",
  async enrich(http, s: SeriesForEnrich): Promise<EnrichResult> {
    let m: AniMedia | null = null;

    if (s.anilistId) m = await query(http, { v: s.anilistId }, "id");
    if (!m && s.malId) m = await query(http, { v: s.malId }, "idMal");
    if (!m) {
      for (const t of [s.titleRomaji, s.titleEnglish, s.title].filter(Boolean)) {
        const hit = await query(http, { v: t }, "search");
        if (
          hit &&
          [hit.title.romaji, hit.title.english, hit.title.native, ...hit.synonyms]
            .filter(Boolean)
            .some((v) => normalizeTitle(v as string) === normalizeTitle(t as string))
        ) {
          m = hit;
          break;
        }
      }
    }

    return m ? toResult(m) : { matched: false };
  },
};
