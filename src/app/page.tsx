import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HomeVisualExplorer } from "@/components/HomeVisualExplorer";

const garmentCards = [
  {
    label: "Shirts",
    number: "01",
    image: "https://images.pexels.com/photos/6764950/pexels-photo-6764950.jpeg?auto=compress&cs=tinysrgb&w=1200",
    copy: "Collars, cuffs, fit and cloth character.",
  },
  {
    label: "Trousers",
    number: "02",
    image: "https://images.pexels.com/photos/6766233/pexels-photo-6766233.jpeg?auto=compress&cs=tinysrgb&w=1200",
    copy: "Pleats, rise, taper, break and proportion.",
  },
  {
    label: "Suits",
    number: "03",
    image: "https://images.pexels.com/photos/6764929/pexels-photo-6764929.jpeg?auto=compress&cs=tinysrgb&w=1200",
    copy: "Structure, lapel, stance and occasion logic.",
  },
  {
    label: "Blazers",
    number: "04",
    image: "https://images.pexels.com/photos/6764919/pexels-photo-6764919.jpeg?auto=compress&cs=tinysrgb&w=1200",
    copy: "Soft tailoring through sharper formal layers.",
  },
];

const editorialRefs = [
  {
    image: "https://images.pexels.com/photos/6765003/pexels-photo-6765003.jpeg?auto=compress&cs=tinysrgb&w=1400",
    title: "Consultation before recommendation",
    copy: "The system should feel like entering a private atelier, not filling a generic product form.",
  },
  {
    image: "https://images.pexels.com/photos/6764999/pexels-photo-6764999.jpeg?auto=compress&cs=tinysrgb&w=1400",
    title: "Craft stays visible",
    copy: "Digital intelligence should still lead naturally toward fabric, fitting and tailoring.",
  },
];

export default function Home() {
  return <AppShell>
    <section className="brandMasthead wrap">
      <p>PREMIUM FABRICS · INTELLIGENT MENSWEAR · DIGITAL ATELIER</p>
      <h1><span>LLinen</span> Earth</h1>
      <div className="mastheadRule"><span>EST. FOR A NEW WAY TO DESIGN</span><i /></div>
    </section>

    <section className="homeHero wrap">
      <div className="heroStatement">
        <p className="eyebrow">THE DIGITAL ATELIER</p>
        <h2>See the cloth.<br />See the possibilities.<br /><em>Then let the Designer judge.</em></h2>
        <p className="homeHeroCopy">Explore shirts, trousers, suits and blazers visually on one consistent mannequin. When you want a complete answer instead of browsing, the Designer Engine combines your fabric, occasion and style intent into a considered outfit direction.</p>
        <div className="actions"><Link className="button light" href="/designer">Enter Designer Engine</Link><Link className="button" href="#explore">Explore visually</Link></div>
      </div>
      <div className="heroEditorial" style={{ backgroundImage: "linear-gradient(180deg,rgba(2,7,17,.05),rgba(2,7,17,.82)),url('https://images.pexels.com/photos/6766385/pexels-photo-6766385.jpeg?auto=compress&cs=tinysrgb&w=1600')" }}>
        <div className="heroEditorialTag"><span>01</span><p>Fabric first.<br />Proportion second.<br />Trend last.</p></div>
        <div className="heroEditorialCaption"><span>LLINEN EARTH / ATELIER PRINCIPLE</span><strong>Cloth should decide what the garment can credibly become.</strong></div>
      </div>
    </section>

    <section className="garmentWorld wrap">
      <div className="sectionHead premiumHead"><p className="eyebrow">THE WARDROBE</p><h2>Four foundations. One visual language.</h2></div>
      <div className="garmentColumns">{garmentCards.map((card) => <a href="#explore" key={card.label} className="garmentColumn" style={{ backgroundImage: `linear-gradient(180deg,rgba(3,9,18,.08),rgba(3,9,18,.9)),url('${card.image}')` }}>
        <div className="garmentColumnTop"><span>{card.number}</span><b>EXPLORE →</b></div>
        <div><h3>{card.label}</h3><p>{card.copy}</p></div>
      </a>)}</div>
    </section>

    <section className="designerFeature wrap">
      <div className="designerFeatureMark">AI</div>
      <div className="designerFeatureCopy"><p className="eyebrow">HIGHLIGHTED EXPERIENCE</p><h2>Designer Engine</h2><p>Do not know which shirt, trouser, suit or blazer is right? Upload the cloth and describe the moment. The engine judges fabric suitability, formality, climate, silhouette and aesthetic before it proposes the complete outfit.</p><div className="designerSignals"><span>FABRIC JUDGEMENT</span><span>OCCASION LOGIC</span><span>OUTFIT DIRECTION</span><span>CONTROLLED REFINEMENT</span></div></div>
      <div className="designerFeatureAction"><span>LET THE SYSTEM DECIDE</span><strong>Safe.<br />Elevated.<br />Statement.</strong><Link href="/designer">Start with your fabric <b>↗</b></Link></div>
    </section>

    <div className="wrap"><HomeVisualExplorer /></div>

    <section className="editorialPair wrap">
      {editorialRefs.map((item, index) => <article key={item.title} className={index === 0 ? "editorialCard tall" : "editorialCard"} style={{ backgroundImage: `linear-gradient(180deg,rgba(2,7,17,.03),rgba(2,7,17,.88)),url('${item.image}')` }}><div><span>ATELIER REFERENCE / 0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p></div></article>)}
      <article className="editorialManifesto"><span>LLINEN EARTH / POINT OF VIEW</span><h3>The website should help a customer understand the wardrobe before asking them to make a decision.</h3><p>Browse when you want clarity. Use the Designer when you want judgement. Move to the atelier when the design is ready to become real.</p><Link href="/knowledge">Open the fashion library →</Link></article>
    </section>
  </AppShell>;
}
