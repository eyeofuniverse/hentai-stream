import type { MetadataRoute } from "next";

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // note: the management console is deliberately NOT listed — it's
      // noindex + 404-cloaked, and naming it here would just advertise it
      disallow: ["/api", "/auth", "/login", "/search", "/watchlist", "/submit"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
