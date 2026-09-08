import type { Http } from "@/lib/scraper/http";
import { normalizeTitle } from "@/lib/ingest";
import type { Enricher, EnrichResult, SeriesForEnrich } from "../types";

const API = "https://graphql.anilist.co";

const MEDIA = `
id idMal
title { romaji english native }
synonyms
description(asHtml: false)
seasonYear
averageScore
coverImage { extraLarge large }
bannerImage
isAdult
studios(isMain: true) { nodes { name } }
tags { name rank isGeneralSpoiler }
characters(sort: [ROLE, RELEVANCE], perPage: 20) { nodes { name { full } } }
`;

interface AniMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  description: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  isAdult: boolean;
  studios: { nodes: { name: string }[] };
  tags: { name: string; rank: number; isGeneralSpoiler: boolean }[];
  characters: { nodes: { name: { full: string | null } }[] };
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
  try {
    const r = await http.postJson<{ data?: { Media?: AniMedia | null } }>(API, {
      query: q,
      variables: { v: vars.v },
    });
    return r.data?.Media ?? null;
  } catch {
    return null;
  }
}

function toResult(m: AniMedia): EnrichResult {
  const desc = m.description
    ? m.description.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim()
    : null;
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
      isCensored: null, // AniList doesn't track this
      studioName: m.studios.nodes[0]?.name ?? null,
    },
    tags: m.tags
      .filter((t) => !t.isGeneralSpoiler && t.rank >= 25)
      .map((t) => t.name),
    characters: m.characters.nodes
      .map((c) => c.name.full)
      .filter((x): x is string => !!x),
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
