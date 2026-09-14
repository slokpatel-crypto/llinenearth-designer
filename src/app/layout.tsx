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
import { BrandIntro } from "@/components/BrandIntro";

export const metadata: Metadata = {
  title: "LLinen Earth — AI Atelier",
  description: "A premium digital atelier for fabric-led menswear design.",
  metadataBase: new URL("https://llinenearth-designer.vercel.app"),
  icons: {
    icon: "/brand/llinen-earth-logo.png",
    apple: "/brand/llinen-earth-logo.png",
  },
  openGraph: {
    title: "LLinen Earth — AI Atelier",
    description: "A premium digital atelier for fabric-led menswear design.",
    url: "https://llinenearth-designer.vercel.app",
    siteName: "LLinen Earth",
    images: [{ url: "/brand/llinen-earth-logo.png", width: 1273, height: 531 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLinen Earth — AI Atelier",
    description: "A premium digital atelier for fabric-led menswear design.",
    images: ["/brand/llinen-earth-logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><BrandIntro />{children}</body></html>;
}
