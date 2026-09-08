import type { Http } from "@/lib/scraper/http";
import { normalizeTitle } from "@/lib/ingest";
import type { Enricher, EnrichResult, SeriesForEnrich } from "../types";

/**
 * nhentai.net — best granular-tag + character + parody source, but manga-focused
 * and behind Cloudflare. We search the source-manga title, take a confident
 * title match, and lift its tags. If Cloudflare blocks us the enricher just
 * returns unmatched (the run logs it) — a CF-bypass proxy can be slotted into
 * the Http layer later.
 */
const BASE = "https://nhentai.net/api";

interface NhTag {
  type: "tag" | "artist" | "parody" | "character" | "group" | "language" | "category";
  name: string;
}
interface NhGallery {
  id: number;
  title: { english?: string | null; japanese?: string | null; pretty?: string | null };
  tags: NhTag[];
}

async function search(http: Http, q: string): Promise<NhGallery[]> {
  for (const path of [
    `${BASE}/galleries/search?query=${encodeURIComponent(q)}`,
    `${BASE}/v2/galleries/search?query=${encodeURIComponent(q)}`,
  ]) {
    try {
      const r = await http.getJson<{ result?: NhGallery[] }>(path);
      if (r.result?.length) return r.result;
    } catch {
      /* try next path / give up */
    }
  }
  return [];
}

async function gallery(http: Http, id: number): Promise<NhGallery | null> {
  for (const path of [`${BASE}/gallery/${id}`, `${BASE}/v2/gallery/${id}`]) {
    try {
      return await http.getJson<NhGallery>(path);
    } catch {
      /* try next */
    }
  }
  return null;
}

function names(g: NhGallery): string[] {
  return [g.title.english, g.title.pretty, g.title.japanese]
    .filter(Boolean)
    .map((t) => normalizeTitle(t as string));
}

function toResult(g: NhGallery, confidence: number): EnrichResult {
  const by = (t: NhTag["type"]) => g.tags.filter((x) => x.type === t).map((x) => x.name);
  const clean = (n: string) => n.replace(/\s*\|\s*.*/, "").trim(); // drop " | jp name"
  return {
    matched: true,
    externalId: g.id,
    confidence,
    tags: by("tag"),
    characters: by("character").map(clean),
    parody: by("parody").filter((p) => p.toLowerCase() !== "original")[0] ?? null,
    artist: by("artist")[0] ?? null,
  };
}

export const nhentai: Enricher = {
  name: "nhentai",
  async enrich(http, s: SeriesForEnrich): Promise<EnrichResult> {
    if (s.nhentaiId) {
      const g = await gallery(http, s.nhentaiId);
      if (g) return toResult(g, 1);
    }

    const queries = [s.titleRomaji, s.titleEnglish, s.title, s.titleOriginal].filter(
      Boolean,
    ) as string[];
    const wantNorms = new Set(
      queries.map(normalizeTitle).concat(s.altTitles.map(normalizeTitle)),
    );

    for (const q of queries.slice(0, 2)) {
      const results = await search(http, q);
      let bestG: NhGallery | null = null;
      let bestScore = 0;
      for (const g of results.slice(0, 8)) {
        const gn = names(g);
        const score = gn.some((n) => wantNorms.has(n))
          ? 1
          : Math.max(...gn.map((n) => tokenOverlap(n, normalizeTitle(q))), 0);
        if (score > bestScore) {
          bestScore = score;
          bestG = g;
        }
      }
      if (bestG && bestScore >= 0.8) {
        // pull full tag list (search results are sometimes trimmed)
        const full = (await gallery(http, bestG.id)) ?? bestG;
        return toResult(full, bestScore);
      }
    }
    return { matched: false };
  },
};

function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter((t) => t.length > 1));
  const B = new Set(b.split(" ").filter((t) => t.length > 1));
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
}
