import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeVisualExplorer } from "@/components/HomeVisualExplorer";

export default function VisualPage(){
  return <AppShell>
    <section className="modulePageHero wrap">
      <p className="eyebrow">LIVE GARMENT VISUAL · FABRIC MAPPING</p>
      <h1>See the cloth on the garment.</h1>
      <p>Choose a shirt, trouser, suit or blazer, switch styling details, then upload a real fabric photo. The visualizer maps that cloth image onto the garment surface while keeping studio lighting, seams and folds visible.</p>
      <Link className="modulePageBack" href="/">← Back to the atelier entrance</Link>
    </section>
    <div className="wrap"><HomeVisualExplorer /></div>
  </AppShell>;
}
