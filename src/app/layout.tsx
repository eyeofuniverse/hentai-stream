import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";
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
  "Stream subbed, dubbed and uncensored hentai — series, OVAs and movies — free in HD. Updated daily. 18+ only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${SITE_NAME} — Watch Hentai Online, Subbed & Uncensored`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESC,
  applicationName: SITE_NAME,
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
    title: `${SITE_NAME} — Watch Hentai Online`,
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESC },
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
      <body
        suppressHydrationWarning
        className="min-h-screen bg-bg font-sans text-[#ececf1] antialiased"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationLd(), websiteLd()]),
          }}
        />
        <AgeGate />
        <SiteHeader />
        <div className="min-h-[60vh]">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
