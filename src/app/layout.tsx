import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { YandexMetrica } from "@/components/YandexMetrica";
import { PageTracker } from "@/components/PageTracker";
import { GlobalPopUnder } from "@/components/ads/GlobalPopUnder";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE, SITE_NAME, organizationLd, websiteLd } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const DESC =
  "Watch hentai online free in HD on LustHentai — 1,500+ subbed and uncensored series, OVAs and movies, with a fast ad-light player and no sign-up. New episodes added daily. 18+ only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${SITE_NAME} — Watch Hentai Online, Subbed & Uncensored`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESC,
  applicationName: SITE_NAME,
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    url: SITE,
    title: `${SITE_NAME} — Watch Hentai Online, Subbed & Uncensored`,
    description: DESC,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@lusthentai",
    title: `${SITE_NAME} — Watch Hentai Online`,
    description: DESC,
    images: ["/opengraph-image"],
  },
  other: {
    // ExoClick site verification
    "6a97888e-site-verification": "a783017d136a5ea8d282872b8d96abb9",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable}`}
    >
      <head>
        {/* covers/thumbnails are the LCP element on most pages — save the
            connection-setup round trip (DNS + TCP + TLS) for the moment the
            browser makes its first actual request to this origin */}
        <link rel="preconnect" href={`https://${process.env.NEXT_PUBLIC_R2_PUBLIC_HOST}`} crossOrigin="" />
        <link rel="dns-prefetch" href={`https://${process.env.NEXT_PUBLIC_R2_PUBLIC_HOST}`} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-bg font-sans text-[#ececf1] antialiased"
      >
        <SiteHeader />
        <div className="min-h-[60vh]">{children}</div>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationLd(), websiteLd()]),
          }}
        />
        <Analytics />
        <YandexMetrica />
        <PageTracker />
        <GlobalPopUnder />
      </body>
    </html>
  );
}
