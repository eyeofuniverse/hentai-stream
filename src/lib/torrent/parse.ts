/**
 * Parse a torrent release title into what we can use: the series name guess, the
 * episode numbers it covers, quality, and whether it's uncensored / a batch.
 * Release titles are chaotic — be conservative, and only trust an episode
 * mapping we can extract cleanly.
 */
export interface ParsedRelease {
  seriesGuess: string;
  episodes: number[]; // [] = couldn't tell / single unnumbered file
  isBatch: boolean;
  quality: number; // 0 | 480 | 720 | 1080 | 2160
  uncensored: boolean | null;
  group: string | null;
}

const QUAL = (s: string): number => {
  const m = s.match(/\b(2160|1440|1080|720|480|360)p?\b/i);
  if (m) return Number(m[1]);
  if (/\b4k|uhd\b/i.test(s)) return 2160;
  if (/\bfhd\b/i.test(s)) return 1080;
  if (/\bhd\b/i.test(s)) return 720;
  return 0;
};

/** strip the leading "[Group] " and trailing "[tags]" / "(tags)" clutter */
function core(title: string): { body: string; group: string | null } {
  let s = title.trim();
  const g = s.match(/^\[([^\]]+)\]\s*/);
  const group = g ? g[1] : null;
  s = s.replace(/^\[[^\]]+\]\s*/, "");
  // drop everything after the first bracket/paren group that starts the tag soup
  s = s
    .replace(/\.(mkv|mp4|avi|wmv|ts|m4v)$/i, "")
    .replace(/[\[(](?:[^\])]*?)(?:1080|720|480|x26[45]|hevc|aac|flac|bluray|bd|web|dl|uncensored|censored|dual|multi|sub|dub|raw|10.?bit|hi10)[^\])]*[\])]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { body: s, group };
}

function episodesFrom(body: string): { eps: number[]; batch: boolean } {
  // range: "01-12", "01~12", "E01-E12", "Vol.1-3"
  const range =
    body.match(/(?:\b|e|ep|episode|vol\.?)\s*(\d{1,3})\s*(?:-|~|to|–)\s*(?:e|ep)?\s*(\d{1,3})\b/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (b > a && b - a < 60) {
      return { eps: Array.from({ length: b - a + 1 }, (_, i) => a + i), batch: true };
    }
  }
  if (/\b(batch|complete|全\d+話|season\s*\d|collection)\b/i.test(body)) {
    return { eps: [], batch: true };
  }
  // single: "- 07", "Episode 7", "EP07", "#7", "第7話"
  const single =
    body.match(/(?:\s-\s|\bep(?:isode)?\.?\s*|#|第)\s*0*(\d{1,3})(?:v\d)?\b(?!\s*(?:-|~))/i) ||
    body.match(/\s0*(\d{1,2})\s*(?:\(|\[|$)/);
  if (single) {
    const n = Number(single[1]);
    if (n > 0 && n < 300) return { eps: [n], batch: false };
  }
  return { eps: [], batch: false };
}

export function parseRelease(title: string): ParsedRelease {
  const { body, group } = core(title);
  const { eps, batch } = episodesFrom(body);

  // series name = body with episode/volume markers stripped
  const seriesGuess = body
    .replace(/(?:\s-\s|\bep(?:isode)?\.?\s*|\bvol\.?\s*|#|第)\s*\d{1,3}(?:\s*(?:-|~|to|–)\s*\d{1,3})?(?:話|v\d)?/gi, " ")
    .replace(/\b(batch|complete|collection|uncensored|censored|the animation|bd|bluray)\b/gi, " ")
    .replace(/[_.]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    seriesGuess,
    episodes: eps,
    isBatch: batch,
    quality: QUAL(title),
    uncensored: /\buncensored\b/i.test(title)
      ? true
      : /\bcensored\b/i.test(title)
        ? false
        : null,
    group,
  };
}

/** Map a downloaded video filename to an episode number (part 1 assumed). */
export function episodeOfFile(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, "");
  const p = parseRelease(base);
  if (p.episodes.length === 1) return p.episodes[0];
  // last resort: a lone 1–3 digit number near the end
  const m = base.match(/(?:^|[\s\-_.\[(])0*(\d{1,3})(?:v\d)?[\s\-_.\])]*$/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n < 300) return n;
  }
  return null;
}
