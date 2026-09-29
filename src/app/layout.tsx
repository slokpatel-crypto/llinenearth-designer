import type { Metadata } from "next";
import "./globals.css";
import "./phase7.css";
import "./phase9.css";
import "./home-premium.css";
import "./mannequin-premium.css";
import "./brand-intro-fix.css";
import "./home-motion.css";
import "./occasion-bridge.css";
import "./gateway-v2.css";
import "./visual-sharp.css";
import "./designer-premium.css";
import "./intelligence-v3.css";
import "./business-conversion.css";
import "./home-contact.css";
import "./homepage-editorial.css";
import "./light-theme.css";
import "./outfit-studio.css";
import "./contact-dock.css";
import "./finish-polish.css";
import { BrandIntro } from "@/components/BrandIntro";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://linenearth.com")
).replace(/\/$/,"");

export const metadata: Metadata = {
  title: "Linen Earth — AI Atelier",
  description: "A premium digital atelier for fabric-led menswear design.",
  alternates: { canonical: SITE_URL },
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/brand/linen-earth-logo.png",
    apple: "/brand/linen-earth-logo.png",
  },
  openGraph: {
    title: "Linen Earth — AI Atelier",
    description: "A premium digital atelier for fabric-led menswear design.",
    url: SITE_URL,
    siteName: "Linen Earth",
    images: [{ url: "/brand/linen-earth-logo.png", width: 1273, height: 531 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Linen Earth — AI Atelier",
    description: "A premium digital atelier for fabric-led menswear design.",
    images: ["/brand/linen-earth-logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><BrandIntro />{children}</body></html>;
}
