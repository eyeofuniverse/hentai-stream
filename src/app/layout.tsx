import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LustHentai — watch hentai online, subbed & uncensored",
    template: "%s — LustHentai",
  },
  description:
    "Stream subbed, dubbed and uncensored hentai series, OVAs and movies. Updated daily. 18+ only.",
  robots: { index: true, follow: true },
  openGraph: { siteName: "LustHentai", type: "website" },
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
        <AgeGate />
        <SiteHeader />
        <div className="min-h-[60vh]">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
