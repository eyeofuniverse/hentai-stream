import type { Http } from "@/lib/scraper/http";

/** the subset of a Series an enricher needs to find its match */
export interface SeriesForEnrich {
  id: string;
  title: string;
  titleEnglish: string | null;
  titleRomaji: string | null;
  titleOriginal: string | null;
  altTitles: string[];
  year: number | null;
  malId: number | null;
  anilistId: number | null;
  nhentaiId: number | null;
  hanimeSlug: string | null;
  anidbId: number | null;
}

export interface EnrichEpisode {
  number: number;
  part?: number;
  title?: string | null;
  synopsis?: string | null;
  thumbUrl?: string | null;
  airedAt?: string | null;
}

export interface EnrichResult {
  matched: boolean;
  /** external id/slug to persist for idempotency */
  externalId?: string | number | null;
  confidence?: number;
  series?: {
    titleEnglish?: string | null;
    titleOriginal?: string | null;
    titleRomaji?: string | null;
    synopsis?: string | null;
    coverUrl?: string | null;
    bannerUrl?: string | null;
    isCensored?: boolean | null;
    studioName?: string | null;
    externalScore?: number | null;
    year?: number | null;
    releaseDate?: Date | null;
  };
  tags?: string[];
  characters?: string[];
  parody?: string | null;
  artist?: string | null;
  episodes?: EnrichEpisode[];
}

export interface Enricher {
  /** "anilist" | "nhentai" | "hanime" | "anidb" */
  name: string;
  enrich(http: Http, series: SeriesForEnrich): Promise<EnrichResult>;
}
