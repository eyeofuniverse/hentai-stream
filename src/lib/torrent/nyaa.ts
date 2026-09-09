import * as cheerio from "cheerio";

/**
 * sukebei.nyaa.si — the adult sister of nyaa. RSS gives title, torrent link,
 * infoHash, seeders, size. We build a magnet from the infoHash + public
 * trackers so aria2c can fetch it.
 */
const BASE = "https://sukebei.nyaa.si";

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://open.demonii.com:1337/announce",
  "http://nyaa.tracker.wf:7777/announce",
];

export interface NyaaResult {
  title: string;
  infoHash: string;
  magnet: string;
  seeders: number;
  leechers: number;
  sizeBytes: number;
  date: string;
}

function sizeToBytes(s: string): number {
  const m = s.match(/([\d.]+)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB)/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult: Record<string, number> = {
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    kb: 1e3,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
  };
  return Math.round(n * (mult[unit] ?? 1));
}

function magnetFor(hash: string, name: string): string {
  const tr = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${tr}`;
}

/** Anime category (1_1), sorted by seeders. `q` should be a plain title. */
export async function nyaaSearch(query: string): Promise<NyaaResult[]> {
  const q = query.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const url = `${BASE}/?page=rss&c=1_1&f=0&s=seeders&o=desc&q=${encodeURIComponent(q)}`;

  let xml: string;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0", accept: "application/rss+xml,*/*" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  const $ = cheerio.load(xml, { xmlMode: true });
  const out: NyaaResult[] = [];
  $("item").each((_, el) => {
    const it = $(el);
    const title = it.find("title").text().trim();
    const infoHash = it.find("nyaa\\:infoHash, infoHash").text().trim().toLowerCase();
    if (!title || !/^[a-f0-9]{40}$/.test(infoHash)) return;
    out.push({
      title,
      infoHash,
      magnet: magnetFor(infoHash, title),
      seeders: Number(it.find("nyaa\\:seeders, seeders").text()) || 0,
      leechers: Number(it.find("nyaa\\:leechers, leechers").text()) || 0,
      sizeBytes: sizeToBytes(it.find("nyaa\\:size, size").text()),
      date: it.find("pubDate").text().trim(),
    });
  });
  return out;
}
