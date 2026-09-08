import type { SiteAdapter } from "../types";
import { NotImplemented } from "../types";
import { watchhentai } from "./watchhentai";
import { hentaimama } from "./hentaimama";

/* Adapters still to be wired — known URL shapes below, finished once we have a
 * sample series + episode page from each (they need live HTML for selectors). */

function stub(name: string, baseUrl: string): SiteAdapter {
  return {
    name,
    baseUrl,
    // eslint-disable-next-line require-yield
    async *crawl() {
      throw new NotImplemented(name);
    },
    async findRefsByTitle() {
      throw new NotImplemented(name);
    },
    async fetchSources() {
      throw new NotImplemented(name);
    },
  };
}

// URL shapes, to be filled once we have a sample series + episode page:
//   hentaigasm — flat WP, post == episode: /wp-sitemap-posts-post-N.xml → /<slug>/
//   miohentai  — WP, post == episode: /post-sitemap{,2,3,4}.xml + /video-sitemap.xml
//   hentaila   — custom ES, no XML sitemap: /media/<slug>, /ver/<slug>-<n>
const hentaigasm = stub("hentaigasm", "https://hentaigasm.com");
const miohentai = stub("miohentai", "https://miohentai.com");
const hentaila = stub("hentaila", "https://hentaila.com");

export const ADAPTERS: Record<string, SiteAdapter> = {
  watchhentai,
  hentaimama,
  hentaigasm,
  miohentai,
  hentaila,
};

export function getAdapter(name: string): SiteAdapter {
  const a = ADAPTERS[name];
  if (!a) throw new Error(`unknown site "${name}" (have: ${Object.keys(ADAPTERS).join(", ")})`);
  return a;
}
