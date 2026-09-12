import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { knowledgeSummary } from "@/lib/knowledge";

const refs = [
  { img: "https://images.pexels.com/photos/6766385/pexels-photo-6766385.jpeg", title: "The atelier", copy: "Construction, proportion and material should read as one system." },
  { img: "https://images.pexels.com/photos/6766382/pexels-photo-6766382.jpeg", title: "Measured, not generic", copy: "The digital experience stays rooted in tailoring craft." },
  { img: "https://images.pexels.com/photos/6764999/pexels-photo-6764999.jpeg", title: "A modern menswear world", copy: "Quiet confidence rather than an AI-dashboard aesthetic." },
];

export default function Home() {
  const intelligenceCount = knowledgeSummary.garments + knowledgeSummary.fabrics + knowledgeSummary.contexts + knowledgeSummary.aesthetics;
  return <AppShell>
    <section className="hero wrap">
      <div>
        <p className="eyebrow">LLINEN EARTH · THE DIGITAL ATELIER</p>
        <h1>Begin with fabric. End with a point of view.</h1>
        <p className="lede">Upload a fabric, define the moment, compare designer directions, refine only what matters, and preserve the final look as a locked LLinen Earth design.</p>
        <div className="actions"><Link className="button light" href="/designer">Start designing</Link><Link className="button" href="/designs">View saved designs</Link></div>
        <div className="meta"><span>Fabric-aware</span><span>Context-aware</span><span>Controlled refinement</span></div>
      </div>
      <div className="visual">
        <div className="mainPhoto" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,9,17,.02),rgba(5,9,17,.76)),url('${refs[0].img}')` }} />
        <div className="detailPhoto" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,9,17,.02),rgba(5,9,17,.64)),url('${refs[1].img}')` }} />
        <div className="insight"><span>FASHION BRAIN</span><strong>{intelligenceCount}</strong><p>curated garment, fabric, context and aesthetic records.</p></div>
      </div>
    </section>

    <section className="premiumJourney wrap">
      <div className="sectionHead"><p className="eyebrow">THE EXPERIENCE</p><h2>Not a chatbot. A guided design process with a memory of every decision.</h2></div>
      <div className="journeyRail">
        <article><span>01</span><h3>Read the fabric</h3><p>Upload, analyze and correct material assumptions before design begins.</p></article>
        <article><span>02</span><h3>Set the context</h3><p>Occasion, venue, climate, formality, impression and fit shape the brief.</p></article>
        <article><span>03</span><h3>Choose a direction</h3><p>Compare Safe, Elevated and Statement concepts with explicit tradeoffs.</p></article>
        <article><span>04</span><h3>Refine & preserve</h3><p>Lock components, version changes, visualize the final spec and save it.</p></article>
      </div>
    </section>

    <section className="section wrap" id="garments">
      <div className="sectionHead"><p className="eyebrow">FASHION BRAIN · V1</p><h2>A system that understands why garments, fabrics and occasions work together.</h2></div>
      <div className="stats"><Link href="/knowledge"><span>GARMENTS</span><strong>{knowledgeSummary.garments}</strong><p>Structured archetypes and construction signals.</p></Link><Link href="/knowledge" id="fabrics"><span>FABRICS</span><strong>{knowledgeSummary.fabrics}</strong><p>Material behavior, climate and garment suitability.</p></Link><Link href="/knowledge"><span>CONTEXTS</span><strong>{knowledgeSummary.contexts}</strong><p>Occasion, venue, time and formality logic.</p></Link><Link href="/knowledge"><span>AESTHETICS</span><strong>{knowledgeSummary.aesthetics}</strong><p>Designer identities encoded as measurable signals.</p></Link></div>
    </section>

    <section className="section wrap">
      <div className="sectionHead"><p className="eyebrow">VISUAL WORLD</p><h2>Tailoring craft, translated into a darker digital language.</h2></div>
      <div className="refGrid">{refs.map((r, i) => <article key={r.title} className={i === 0 ? "ref wide" : "ref"} style={{ backgroundImage: `linear-gradient(180deg,rgba(6,11,20,.05),rgba(6,11,20,.9)),url('${r.img}')` }}><div><span>REFERENCE</span><h3>{r.title}</h3><p>{r.copy}</p></div></article>)}</div>
    </section>

    <section className="section wrap" id="atelier">
      <div className="sectionHead"><p className="eyebrow">DIGITAL → PHYSICAL</p><h2>A finished concept should be able to continue into real fabric, tailoring and consultation.</h2></div>
      <div className="phase7Status"><div><span>PRODUCT STATUS</span><strong>Core digital atelier journey live through Phase 7.</strong></div><Link href="/designer">Enter the Designer →</Link></div>
    </section>
  </AppShell>;
}
