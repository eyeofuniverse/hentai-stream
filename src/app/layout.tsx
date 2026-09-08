import type { Metadata } from "next";
import "./globals.css";
import { AgeGate } from "@/components/AgeGate";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-bg text-[#ececf1] antialiased"
      >
        <AgeGate />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
