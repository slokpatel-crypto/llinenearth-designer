import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeMotion } from "@/components/HomeMotion";

const designerRefs = [
  "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765068/pexels-photo-6765068.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765003/pexels-photo-6765003.jpeg?auto=compress&cs=tinysrgb&w=600",
];
const visualRefs = [
  "https://images.pexels.com/photos/6766236/pexels-photo-6766236.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6766385/pexels-photo-6766385.jpeg?auto=compress&cs=tinysrgb&w=600",
];

export default function Home() {
  return <AppShell>
    <HomeMotion />
    <main className="gatewayHome">
      <section className="gatewayBrand wrap" data-reveal>
        <p>PREMIUM FABRICS · INTELLIGENT MENSWEAR · DIGITAL ATELIER</p>
        <h1><span>LLinen</span> Earth</h1>
        <div className="gatewayLine"><span>FABRIC FIRST · DESIGN WITH INTENT</span><i /></div>
      </section>

      <section className="gatewayIntro wrap" data-reveal>
        <div><p className="eyebrow">CHOOSE HOW YOU WANT TO DESIGN</p><h2>Two ways into the atelier.</h2></div>
        <p>Use the Designer when you want LLinen Earth to decide what works for your occasion. Use Live Visual when you already know what you want and want to see garment, style and fabric clearly on the mannequin.</p>
      </section>

      <section className="gatewayChoices wrap" data-reveal>
        <Link href="/designer-brief" className="gatewayCard gatewayDesigner">
          <div className="gatewayImage gatewayImageDesigner" />
          <div className="gatewayCardTop"><span>01</span><b>AI DESIGNER ENGINE</b></div>
          <div className="gatewayVisualStrip" aria-hidden="true">{designerRefs.map((src,index)=><div key={src} className="gatewayMini" style={{backgroundImage:`url('${src}')`}} data-index={index}/>)}</div>
          <div className="gatewayCardCopy">
            <p className="eyebrow">GUIDED DESIGN</p><h3>Find the right outfit for the moment.</h3>
            <p>Occasion, venue, time, climate, formality, impression, fit and aesthetic are narrowed before the cloth is judged.</p>
            <div className="gatewaySignals"><span>OCCASION</span><span>FABRIC</span><span>FIT</span><span>OUTFIT</span></div>
            <strong>Start Designer <i>↗</i></strong>
          </div>
        </Link>

        <Link href="/visual" className="gatewayCard gatewayVisual">
          <div className="gatewayImage gatewayImageVisual" />
          <div className="gatewayCardTop"><span>02</span><b>LIVE GARMENT VISUAL</b></div>
          <div className="gatewayVisualStrip" aria-hidden="true">{visualRefs.map((src,index)=><div key={src} className="gatewayMini" style={{backgroundImage:`url('${src}')`}} data-index={index}/>)}</div>
          <div className="gatewayCardCopy">
            <p className="eyebrow">VISUAL CLARITY</p><h3>See the garment before you decide.</h3>
            <p>Choose shirt, trouser, suit or blazer, change styling details, and map a real fabric photograph onto the garment surface.</p>
            <div className="gatewaySignals"><span>SHIRT</span><span>TROUSER</span><span>SUIT</span><span>BLAZER</span></div>
            <strong>Open Live Visual <i>↗</i></strong>
          </div>
        </Link>
      </section>

      <section className="gatewayFoot wrap" data-reveal><span>LLINEN EARTH / DIGITAL ATELIER</span><p>Designer for judgement. Live Visual for clarity. Atelier for execution.</p></section>
    </main>
  </AppShell>;
}
