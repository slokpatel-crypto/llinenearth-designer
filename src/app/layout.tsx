import type { Metadata } from "next";
import "./globals.css";
import "./phase7.css";
import "./phase9.css";
import "./home-premium.css";
import "./mannequin-premium.css";
import "./brand-intro-fix.css";
import { BrandIntro } from "@/components/BrandIntro";

export const metadata: Metadata = {
  title: "LLinen Earth — AI Atelier",
  description: "A premium digital atelier for fabric-led menswear design.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><BrandIntro />{children}</body></html>;
}
