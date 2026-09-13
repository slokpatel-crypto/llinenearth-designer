import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { OccasionDesignerPreview } from "@/components/OccasionDesignerPreview";

export default function DesignerBriefPage(){
  return <AppShell>
    <div className="designerBriefPage">
      <section className="modulePageHero wrap">
        <p className="eyebrow">AI DESIGNER ENGINE · OCCASION FIRST</p>
        <h1>Tell us the moment.</h1>
        <p>LLinen Earth narrows the wardrobe using occasion, setting, time, environment, formality, impression, fit and aesthetic before your fabric enters the decision.</p>
        <Link className="modulePageBack" href="/">← Back to the atelier entrance</Link>
      </section>
      <div className="wrap"><OccasionDesignerPreview /></div>
    </div>
  </AppShell>;
}
