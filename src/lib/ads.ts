import { unstable_cache } from "next/cache";
import { prisma, db } from "@/lib/db";

/* ─────────────────────────── formats ─────────────────────────── */

export const AD_FORMATS = [
  "300x250",
  "336x280",
  "300x600",
  "160x600",
  "728x90",
  "970x250",
  "970x90",
  "468x60",
  "320x100",
  "320x50",
  "300x100",
  "native",
  "custom",
] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export function formatDims(f: AdFormat): { w: number; h: number } | null {
  if (f === "native" || f === "custom") return null;
  const [w, h] = f.split("x").map(Number);
  return { w, h };
}

/* ─────────────────────────── slot registry ─────────────────────────── */

export type SlotDef = {
  key: string;
  name: string;
  where: string;
  page: "watch" | "series" | "home" | "catalog" | "search" | "calendar";
  desktop: boolean;
  mobile: boolean;
  rec: { desktop?: AdFormat; mobile?: AdFormat };
};

/**
 * Every ad position in the product. Code references a slot by `key`; the admin
 * panel only ever edits slots that appear here. `desktop`/`mobile` say whether
 * that breakpoint has a variant at all (a rail slot is desktop-only).
 */
export const AD_SLOTS: SlotDef[] = [
  // ── episode / watch page ──
  { key: "watch-rail-top", name: "Watch · rail top", where: "Right rail, above the episode list (desktop layout only)", page: "watch", desktop: true, mobile: false, rec: { desktop: "300x250" } },
  { key: "watch-rail-mid", name: "Watch · rail sticky", where: "Right rail, sticks while you scroll (desktop only)", page: "watch", desktop: true, mobile: false, rec: { desktop: "300x600" } },
  { key: "watch-under-player", name: "Watch · under player", where: "Directly beneath the video, above the title", page: "watch", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "300x250" } },
  { key: "watch-below-episodes", name: "Watch · below episodes (mobile)", where: "After the episode list on phones (rail covers desktop)", page: "watch", desktop: false, mobile: true, rec: { mobile: "300x250" } },
  { key: "watch-in-content", name: "Watch · in content", where: "Between the FAQ and 'You might also like'", page: "watch", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "300x250" } },
  { key: "watch-footer", name: "Watch · footer", where: "Below 'Explore more', end of page", page: "watch", desktop: true, mobile: true, rec: { desktop: "970x250", mobile: "320x100" } },

  // ── series page ──
  { key: "series-under-hero", name: "Series · under hero", where: "Between the series header and the episode grid", page: "series", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "320x100" } },
  { key: "series-under-episodes", name: "Series · under episodes", where: "Between the episode grid and the About block", page: "series", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "300x250" } },
  { key: "series-footer", name: "Series · footer", where: "End of the series page", page: "series", desktop: true, mobile: true, rec: { desktop: "970x250", mobile: "320x100" } },

  // ── home ──
  { key: "home-top", name: "Home · under hero", where: "Between the hero carousel and the first rail", page: "home", desktop: true, mobile: true, rec: { desktop: "970x250", mobile: "320x100" } },
  { key: "home-mid", name: "Home · mid", where: "Between content rails, mid-page", page: "home", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "300x250" } },
  { key: "home-footer", name: "Home · footer", where: "End of the homepage", page: "home", desktop: true, mobile: true, rec: { desktop: "970x250", mobile: "320x100" } },

  // ── browse / tag / studio ──
  { key: "catalog-top", name: "Catalog · top", where: "Above the grid on browse / tag / studio pages", page: "catalog", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "320x100" } },
  { key: "catalog-sidebar", name: "Catalog · sidebar", where: "In the filters sidebar (desktop only)", page: "catalog", desktop: true, mobile: false, rec: { desktop: "300x600" } },
  { key: "catalog-footer", name: "Catalog · footer", where: "Below the grid / pagination", page: "catalog", desktop: true, mobile: true, rec: { desktop: "970x250", mobile: "320x100" } },

  // ── search / calendar ──
  { key: "search-top", name: "Search · top", where: "Above search results", page: "search", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "320x100" } },
  { key: "calendar-top", name: "Calendar · top", where: "Above the release calendar", page: "calendar", desktop: true, mobile: true, rec: { desktop: "728x90", mobile: "320x100" } },
];

export const AD_SLOT_BY_KEY = new Map(AD_SLOTS.map((s) => [s.key, s]));

/* ─────────────────────────── config shape ─────────────────────────── */

export type AdVariant = {
  enabled: boolean;
  source: "zone" | "code";
  zoneId: string;
  code: string;
  format: AdFormat;
};

export type SlotConfig = { desktop: AdVariant; mobile: AdVariant };

export type AdConfig = {
  /** master kill-switch — nothing renders when false */
  enabled: boolean;
  network: string;
  /** provider script loaded once site-wide (URL) */
  providerScript: string;
  /** age-gate line: "…you accept our use of cookies and third-party ads" */
  consentLine: boolean;
  popunder: {
    enabled: boolean;
    source: "zone" | "code";
    zoneId: string;
    code: string;
    cooldownHours: number;
  };
  vast: { enabled: boolean; tagUrl: string };
  slots: Record<string, SlotConfig>;
};

const emptyVariant = (format: AdFormat): AdVariant => ({
  enabled: false,
  source: "zone",
  zoneId: "",
  code: "",
  format,
});

export function defaultConfig(): AdConfig {
  const slots: Record<string, SlotConfig> = {};
  for (const s of AD_SLOTS) {
    slots[s.key] = {
      desktop: emptyVariant(s.rec.desktop ?? "728x90"),
      mobile: emptyVariant(s.rec.mobile ?? "300x250"),
    };
  }
  return {
    enabled: false,
    network: "exoclick",
    providerScript: "",
    consentLine: true,
    popunder: { enabled: false, source: "zone", zoneId: "", code: "", cooldownHours: 12 },
    vast: { enabled: false, tagUrl: "" },
    slots,
  };
}

function mergeVariant(base: AdVariant, over?: Partial<AdVariant>): AdVariant {
  if (!over) return base;
  return {
    enabled: over.enabled ?? base.enabled,
    source: over.source ?? base.source,
    zoneId: over.zoneId ?? base.zoneId,
    code: over.code ?? base.code,
    format: over.format ?? base.format,
  };
}

export function mergeConfig(base: AdConfig, over?: Partial<AdConfig> | null): AdConfig {
  if (!over) return base;
  const slots: Record<string, SlotConfig> = {};
  for (const s of AD_SLOTS) {
    const b = base.slots[s.key];
    const o = over.slots?.[s.key];
    slots[s.key] = {
      desktop: mergeVariant(b.desktop, o?.desktop),
      mobile: mergeVariant(b.mobile, o?.mobile),
    };
  }
  return {
    enabled: over.enabled ?? base.enabled,
    network: over.network ?? base.network,
    providerScript: over.providerScript ?? base.providerScript,
    consentLine: over.consentLine ?? base.consentLine,
    popunder: { ...base.popunder, ...(over.popunder ?? {}) },
    vast: { ...base.vast, ...(over.vast ?? {}) },
    slots,
  };
}

/* ─────────────────────────── loader ─────────────────────────── */

export const getAdConfig = unstable_cache(
  async (): Promise<AdConfig> => {
    try {
      const row = await db(() =>
        prisma.setting.findUnique({ where: { key: "ads" } }),
      );
      return mergeConfig(
        defaultConfig(),
        (row?.value as Partial<AdConfig> | undefined) ?? null,
      );
    } catch {
      return defaultConfig();
    }
  },
  ["ad-config"],
  { revalidate: 120, tags: ["ad-config"] },
);

/** Resolve the variant that should show at a given breakpoint, or null. */
export function pickVariant(
  cfg: AdConfig,
  key: string,
  bp: "desktop" | "mobile",
): AdVariant | null {
  if (!cfg.enabled) return null;
  const def = AD_SLOT_BY_KEY.get(key);
  if (!def || !def[bp]) return null;
  const v = cfg.slots[key]?.[bp];
  if (!v || !v.enabled) return null;
  if (v.source === "zone" && !v.zoneId) return null;
  if (v.source === "code" && !v.code.trim()) return null;
  return v;
}
