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
import { BrandIntro } from "@/components/BrandIntro";

export const metadata: Metadata = {
  title: "LLinen Earth — AI Atelier",
  description: "A premium digital atelier for fabric-led menswear design.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><BrandIntro />{children}</body></html>;
}
