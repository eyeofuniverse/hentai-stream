export type RevenueLevel = "very_high" | "high" | "medium";

export type SlotHint = {
  revenue: RevenueLevel;
  format: string;
  size: string;
  why: string;
};

export type SlotDef = {
  label: string;
  page: "watch" | "series" | "home" | "catalog" | "search" | "calendar" | "global";
  description: string;
  /** does this slot have a desktop position at all */
  desktop: boolean;
  /** does this slot have a mobile position at all */
  mobile: boolean;
  recommended: string;
  hint: SlotHint;
};

/*
 * ExoClick banner sizes: 300×250 · 336×280 · 300×600 · 160×600 · 728×90 · 970×250
 * Native adapts to the container. For banner slots with both a desktop and a
 * mobile position, create TWO ExoClick zones (e.g. 728×90 + 300×250) and add
 * them as two ads here — one targeting Desktop, one targeting Mobile.
 */
export const AD_SLOTS: Record<string, SlotDef> = {
  /* ── episode / watch page ── */
  "watch-under-player": {
    label: "Watch — Under Player",
    page: "watch",
    description: "Directly beneath the video, above the episode title",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 300×250 mobile",
    hint: {
      revenue: "very_high",
      format: "Banner (Leaderboard)",
      size: "728×90 desktop · 300×250 mobile",
      why: "The first thing in view after the video — maximum attention while the viewer is settled in. One of the highest-CPM positions on the site.",
    },
  },
  "watch-rail-top": {
    label: "Watch — Rail Top",
    page: "watch",
    description: "Top of the right rail, above the episode list (desktop layout only)",
    desktop: true,
    mobile: false,
    recommended: "300×250",
    hint: {
      revenue: "high",
      format: "Banner (Medium Rectangle)",
      size: "300×250",
      why: "Above-the-fold in the rail. 300×250 has the deepest advertiser demand and highest fill on ExoClick.",
    },
  },
  "watch-rail-sticky": {
    label: "Watch — Rail Sticky",
    page: "watch",
    description: "Lower right rail, pins to the viewport while scrolling (desktop only)",
    desktop: true,
    mobile: false,
    recommended: "300×600",
    hint: {
      revenue: "very_high",
      format: "Banner (Half Page)",
      size: "300×600",
      why: "Stays visible for the whole session — the best viewability score on the site. 300×600 commands a 30–50% CPM premium over 300×250.",
    },
  },
  "watch-below-episodes": {
    label: "Watch — Below Episodes (mobile)",
    page: "watch",
    description: "After the episode list on phones (the rail covers desktop)",
    desktop: false,
    mobile: true,
    recommended: "300×250",
    hint: {
      revenue: "high",
      format: "Banner (Medium Rectangle)",
      size: "300×250",
      why: "Mobile has no rail — this recovers that inventory at a natural scroll pause after the viewer picks their next episode.",
    },
  },
  "watch-in-content": {
    label: "Watch — In Content",
    page: "watch",
    description: "Between the FAQ and the 'You might also like' grid",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 300×250 mobile",
    hint: {
      revenue: "high",
      format: "Native or Banner",
      size: "Native (fluid) · or 728×90 / 300×250",
      why: "Mid-page break between content blocks. Native blends with the related-series grid and lifts CTR 2–3× over a fixed banner here.",
    },
  },
  "watch-footer": {
    label: "Watch — Footer",
    page: "watch",
    description: "Below 'Explore more', end of the episode page",
    desktop: true,
    mobile: true,
    recommended: "970×250 desktop · 320×100 mobile",
    hint: {
      revenue: "medium",
      format: "Banner (Billboard)",
      size: "970×250 desktop · 320×100 mobile",
      why: "Post-scroll position with moderate viewability — good for a large billboard fill or a CPA affiliate offer.",
    },
  },

  /* ── series page ── */
  "series-under-hero": {
    label: "Series — Under Hero",
    page: "series",
    description: "Between the series header and the episode grid",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 320×100 mobile",
    hint: {
      revenue: "high",
      format: "Banner (Leaderboard)",
      size: "728×90 desktop · 320×100 mobile",
      why: "Pre-selection pause point — the viewer stops here before choosing an episode. Strong dwell time.",
    },
  },
  "series-under-episodes": {
    label: "Series — Under Episodes",
    page: "series",
    description: "Between the episode grid and the About block",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 300×250 mobile",
    hint: {
      revenue: "high",
      format: "Banner or Native",
      size: "728×90 desktop · 300×250 mobile",
      why: "The viewer has scanned the episodes — a natural break before the descriptive content.",
    },
  },
  "series-footer": {
    label: "Series — Footer",
    page: "series",
    description: "End of the series page",
    desktop: true,
    mobile: true,
    recommended: "970×250 desktop · 320×100 mobile",
    hint: {
      revenue: "medium",
      format: "Banner (Billboard)",
      size: "970×250 desktop · 320×100 mobile",
      why: "Below the fold — a billboard fill or CPA offer performs best at this depth.",
    },
  },

  /* ── home ── */
  "home-top": {
    label: "Home — Under Hero",
    page: "home",
    description: "Between the hero carousel and the first content rail",
    desktop: true,
    mobile: true,
    recommended: "970×250 desktop · 320×100 mobile",
    hint: {
      revenue: "high",
      format: "Banner (Billboard)",
      size: "970×250 desktop · 320×100 mobile",
      why: "Above-the-fold on the highest-traffic page. A billboard fills the space cleanly under the hero.",
    },
  },
  "home-mid": {
    label: "Home — Mid",
    page: "home",
    description: "Between content rails, mid-page",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 300×250 mobile",
    hint: {
      revenue: "high",
      format: "Native",
      size: "Native (fluid — adapts to container width)",
      why: "Mid-page engagement zone. ExoClick Native blends with the series carousels and beats a fixed banner on CTR here.",
    },
  },
  "home-footer": {
    label: "Home — Footer",
    page: "home",
    description: "End of the homepage",
    desktop: true,
    mobile: true,
    recommended: "970×250 desktop · 320×100 mobile",
    hint: {
      revenue: "medium",
      format: "Banner (Billboard)",
      size: "970×250 desktop · 320×100 mobile",
      why: "Run-of-page fill for users who scroll the whole homepage.",
    },
  },

  /* ── browse / tag / studio ── */
  "catalog-top": {
    label: "Catalog — Top",
    page: "catalog",
    description: "Above the grid on browse / tag / studio pages",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 320×100 mobile",
    hint: {
      revenue: "high",
      format: "Banner (Leaderboard)",
      size: "728×90 desktop · 320×100 mobile",
      why: "High-intent browsing moment — the viewer pauses before picking a title. Tag/studio pages carry a strong relevance signal.",
    },
  },
  "catalog-sidebar": {
    label: "Catalog — Sidebar",
    page: "catalog",
    description: "In the filters sidebar (desktop only)",
    desktop: true,
    mobile: false,
    recommended: "300×600",
    hint: {
      revenue: "very_high",
      format: "Banner (Half Page)",
      size: "300×600",
      why: "Sits beside the grid for the whole browse session — very high viewability. 300×600 earns a premium CPM.",
    },
  },
  "catalog-footer": {
    label: "Catalog — Footer",
    page: "catalog",
    description: "Below the grid and pagination",
    desktop: true,
    mobile: true,
    recommended: "970×250 desktop · 320×100 mobile",
    hint: {
      revenue: "medium",
      format: "Banner (Billboard)",
      size: "970×250 desktop · 320×100 mobile",
      why: "End-of-list fill for users who page through the whole catalogue.",
    },
  },

  /* ── search / calendar ── */
  "search-top": {
    label: "Search — Top",
    page: "search",
    description: "Above the search results",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 320×100 mobile",
    hint: {
      revenue: "very_high",
      format: "Native",
      size: "Native (fluid — adapts to container width)",
      why: "Search intent is the highest-converting signal on any site. Native above the results looks like a sponsored pick — top CTR.",
    },
  },
  "calendar-top": {
    label: "Calendar — Top",
    page: "calendar",
    description: "Above the release calendar",
    desktop: true,
    mobile: true,
    recommended: "728×90 desktop · 320×100 mobile",
    hint: {
      revenue: "medium",
      format: "Banner (Leaderboard)",
      size: "728×90 desktop · 320×100 mobile",
      why: "Calendar visitors are engaged regulars checking for new drops — a clean leaderboard above the grid.",
    },
  },

  /* ── universal ── */
  "global-popunder": {
    label: "Global — Pop-Under",
    page: "global",
    description:
      "Fires once per session on the first click, site-wide (never on the console). Not a visual slot — paste the ExoClick Pop-Under zone script as an 'Ad Network' ad.",
    desktop: true,
    mobile: true,
    recommended: "Pop-Under script only",
    hint: {
      revenue: "very_high",
      format: "Pop-Under",
      size: "Full page (opens behind the current tab)",
      why: "The single highest-RPM format on adult networks. Set the frequency cap in the ExoClick zone (1/hour or 1/day); set Ad Type to 'Ad Network' and paste the zone script.",
    },
  },
};

export type AdSlotId = keyof typeof AD_SLOTS;
export const AD_SLOT_KEYS = Object.keys(AD_SLOTS);

export const REVENUE_META: Record<
  RevenueLevel,
  { label: string; color: string }
> = {
  very_high: { label: "Top earner", color: "#34d399" },
  high: { label: "Strong revenue", color: "#fbbf24" },
  medium: { label: "Steady revenue", color: "#8b5cf6" },
};
