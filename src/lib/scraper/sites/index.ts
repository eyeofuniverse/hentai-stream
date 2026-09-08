import type { SiteAdapter } from "../types";
import { NotImplemented } from "../types";
import { watchhentai } from "./watchhentai";
import { hentaimama } from "./hentaimama";
import { hentaigasm } from "./hentaigasm";
import { miohentai } from "./miohentai";

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

// hentaila — custom ES site, no XML sitemap: /media/<slug>, /ver/<slug>-<n>
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
