"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AtelierMannequin, type MannequinView } from "@/components/AtelierMannequin";
import { BRAND_LOGO_SRC } from "@/lib/brand-logo-data";
import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";

type Tier = "safe" | "elevated" | "statement";

const shirtFabrics = FABRIC_STOCK.filter((fabric)=>fabric.suitableFor.includes("shirt"));
const trouserFabrics = FABRIC_STOCK.filter((fabric)=>fabric.suitableFor.includes("trouser"));

const tierConfig:Record<Tier,{title:string;subtitle:string;accent:string;trouserId:string;rationale:string}> = {
  safe:{
    title:"Safe",
    subtitle:"Restrained neutral architecture",
    accent:"#4A5568",
    trouserId:"linen-suiting-beige",
    rationale:"A quieter direction that keeps the shirt as the visual focus and supports it with a dependable neutral trouser."
  },
  elevated:{
    title:"Elevated",
    subtitle:"Controlled tonal contrast",
    accent:"#6B7A63",
    trouserId:"linen-suiting-perfect-taupe",
    rationale:"A more considered office-ready direction: controlled contrast, clean tailoring and enough tonal separation to feel intentional."
  },
  statement:{
    title:"Statement",
    subtitle:"Stronger value contrast",
    accent:"#C86D51",
    trouserId:"linen-suiting-dark-grey",
    rationale:"The more expressive direction uses a darker supporting trouser while keeping the garment construction and fabric hierarchy disciplined."
  },
};

function tierTrouser(tier:Tier){
  const id=tierConfig[tier].trouserId;
  return trouserFabrics.find((fabric)=>fabric.id===id) || trouserFabrics[0];
}

function Icon({ name }: { name: "search" | "sun" | "moon" | "chevron" | "check" | "bolt" }) {
  const paths: Record<string,string> = {
    search:"m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
    sun:"M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon:"M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
    chevron:"m9 18 6-6-6-6",
    check:"m5 12 4 4L19 6",
    bolt:"m13 2-9 12h7l-1 8 9-12h-7l1-8Z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]}/></svg>;
}

function FabricSwatch({ fabric,selected,onClick }:{fabric:FabricColorway;selected:boolean;onClick:()=>void}){
  return <button className={"fabric-swatch"+(selected?" selected":"")} onClick={onClick}>
    <span className="swatch-texture real"><Image fill sizes="32px" src={fabric.swatchImageUrl} alt=""/></span>
    <span className="swatch-copy"><strong>{fabric.colorName}</strong><small>{fabric.pattern} · {fabric.line}</small></span>
  </button>;
}

export function StudioDashboard(){
  const [selectedFabric,setSelectedFabric]=useState<FabricColorway>(shirtFabrics[0]);
  const [selectedTier,setSelectedTier]=useState<Tier>("elevated");
  const [view,setView]=useState<MannequinView>("front");
  const [occasion,setOccasion]=useState("Business");
  const [formality,setFormality]=useState(3);
  const [time,setTime]=useState("Day");
  const [setting,setSetting]=useState("Indoor");
  const [fit,setFit]=useState("Tailored");
  const [search,setSearch]=useState("");

  const visibleFabrics=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return shirtFabrics.filter((fabric)=>!q || [fabric.colorName,fabric.pattern,fabric.line].some((value)=>value.toLowerCase().includes(q)));
  },[search]);

  const selected= tierConfig[selectedTier];
  const trouser=tierTrouser(selectedTier);

  return <div className="linen-app">
    <header className="studio-header">
      <Link href="/" className="studio-brand-lockup" aria-label="Linen Earth home">
        <img src={BRAND_LOGO_SRC} alt="Linen Earth" />
        <span>DESIGNER STUDIO</span>
      </Link>
      <nav className="mode-nav" aria-label="Designer navigation">
        <span className="active">Designer Studio</span>
        <Link href="/style-director">Style Director</Link>
        <Link href="/operator">Operator Lab</Link>
      </nav>
      <Link href="/style-director" className="styleDirectorQuick">Open Style Director <span>↗</span></Link>
    </header>

    <div className="studio-layout">
      <aside className="studio-sidebar">
        <div className="sidebar-heading"><span>WORKSPACE</span></div>
        <div className="step-list">
          {[["01","Base Fabric Selection","Choose the anchor cloth"],["02","Style & Context","Define the moment"],["03","Model Preview","Inspect the outfit"]].map(([n,title,sub],i)=><div key={n} className={"step-item"+(i===0?" active":"")}><span className="step-num">{n}</span><span><strong>{title}</strong><small>{sub}</small></span><Icon name="chevron"/></div>)}
        </div>
        <div className="side-divider"/>
        <div className="side-section">
          <div className="section-kicker">BASE FABRIC</div>
          <div className="selected-fabric-card">
            <span className="large-swatch real"><Image fill sizes="46px" src={selectedFabric.swatchImageUrl} alt={selectedFabric.colorName}/></span>
            <div><strong>{selectedFabric.colorName}</strong><span>{selectedFabric.line}</span><small>{selectedFabric.pattern} · catalogue reference</small></div>
          </div>
        </div>
        <div className="side-section compact">
          <div className="section-kicker">SHIRTING SEARCH</div>
          <label className="search-field"><Icon name="search"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search colour, pattern or line"/></label>
          <div className="sidebar-swatches">{visibleFabrics.slice(0,8).map((fabric)=><FabricSwatch key={fabric.id} fabric={fabric} selected={fabric.id===selectedFabric.id} onClick={()=>setSelectedFabric(fabric)}/>)}</div>
        </div>
        <div className="sidebar-footer"><span className="inventory-pill">Catalogue references · physical availability verified separately</span></div>
      </aside>

      <main className="studio-main">
        <div className="workspace-title">
          <div><span className="eyebrow">FABRIC-FIRST DESIGNER</span><h1>Build the look around <em>{selectedFabric.colorName}</em></h1><p>Select the cloth, set the context and inspect it on the same faceless model before moving into the full Style Director flow.</p></div>
          <div className="live-badge"><i/> Model restored <span>tucked office fit</span></div>
        </div>

        <section className="visual-hub">
          <div className="hub-heading">
            <div><span className="section-kicker">STYLE DIRECTOR MODEL</span><h2>Fabric + garment preview</h2></div>
            <Link href="/style-director" className="hubDirectorLink">Full Style Director ↗</Link>
          </div>
          <div className="preview-grid restored">
            <div className="fabric-pair-preview">
              <div className="pair-label">SHIRT</div>
              <div className="pair-large-swatch image"><Image fill sizes="300px" src={selectedFabric.swatchImageUrl} alt={selectedFabric.colorName}/><span>{selectedFabric.colorName}</span></div>
              <div className="pair-label second">TROUSER</div>
              <div className="pair-large-swatch image"><Image fill sizes="300px" src={trouser.swatchImageUrl} alt={trouser.colorName}/><span>{trouser.colorName}</span></div>
            </div>

            <div className="mannequin-live">
              <div className="mannequin-view-tabs">
                {(["front","threeQuarter","back"] as MannequinView[]).map((item)=><button key={item} className={view===item?"active":""} onClick={()=>setView(item)}>{item==="threeQuarter"?"3/4":item}</button>)}
              </div>
              <AtelierMannequin
                compact
                view={view}
                shirtColor={selectedFabric.hex}
                trouserColor={trouser.hex}
                shirtStyle="classic"
                trouserStyle="straight"
                layerStyle="none"
                tucked
              />
              <div className="modelTruth"><span>TUCKED SHIRT CONSTRUCTION</span><small>Waistband sits over shirt hem · clean collar, cuffs and crotch boundaries</small></div>
            </div>
          </div>
        </section>

        <div className="recommendations-head"><div><span className="section-kicker">THREE DIRECTIONS</span><h2>Change the styling intensity</h2></div><span>Same shirt anchor · different trouser support</span></div>
        <section className="tier-grid">
          {(Object.keys(tierConfig) as Tier[]).map((tier)=>{
            const item=tierConfig[tier]; const pair=tierTrouser(tier);
            return <article key={tier} className={"tier-card tier-"+tier+(selectedTier===tier?" active":"")} onClick={()=>setSelectedTier(tier)}>
              <div className="tier-top"><span className="tier-dot" style={{background:item.accent}}/><span className="tier-label" style={{color:item.accent}}>{item.title}</span><strong>Direction</strong></div>
              <p className="tier-subtitle">{item.subtitle}</p>
              <div className="mini-outfit">
                <div className="mini-piece"><span className="mini-swatch" style={{background:selectedFabric.hex}}/><div><small>SHIRT</small><span>{selectedFabric.colorName}</span></div></div>
                <div className="mini-piece"><span className="mini-swatch" style={{background:pair.hex}}/><div><small>TROUSER</small><span>{pair.colorName}</span></div></div>
              </div>
              <button className="text-action" onClick={(event)=>{event.stopPropagation();setSelectedTier(tier)}}>Inspect on model <Icon name="chevron"/></button>
            </article>;
          })}
        </section>
        <Link className="generate-button" href="/style-director"><Icon name="bolt"/> Continue in Style Director <span>moment → mood → model</span></Link>
      </main>

      <aside className="studio-detail">
        <div className="detail-top"><span className="section-kicker">SELECTED DIRECTION</span><span className="detail-code">{selected.title.toUpperCase()}</span></div>
        <div className="selected-title"><span className="tier-mini" style={{background:selected.accent}}>{selected.title}</span><h2>Preliminary <small>design direction</small></h2></div>
        <div className="detail-divider"/>
        <div className="detail-section"><span className="section-kicker">OUTFIT</span><p>{selectedFabric.colorName} {selectedFabric.pattern.toLowerCase()} shirt with {trouser.colorName} linen trouser.</p></div>
        <div className="detail-section"><span className="section-kicker">STYLING RATIONALE</span><p>{selected.rationale}</p></div>
        <div className="detail-section"><span className="section-kicker">VISUAL CHECK</span>
          {["Tucked shirt sits behind waistband","Collar opening remains clear of mannequin neck","Sleeves terminate at cuffs, not hands","Trouser crotch is separated, not one flat overlay"].map((rule)=><div className="rule-row" key={rule}><span><Icon name="check"/></span>{rule}</div>)}
        </div>
        <div className="detail-section"><span className="section-kicker">MATERIAL EVIDENCE</span><p>Catalogue colour and pattern are visual references. GSM, drape, composition and physical availability remain separate verification fields.</p></div>
        <div className="detail-section"><span className="section-kicker">CONTEXT</span><div className="context-summary"><span>{occasion}</span><span>Formality {formality}/5</span><span>{time}</span><span>{setting}</span><span>{fit} fit</span></div></div>
        <div className="detail-actions"><Link href="/style-director" className="primary">Open full Style Director <Icon name="chevron"/></Link></div>
      </aside>
    </div>

    <section className="context-drawer">
      <div><span className="section-kicker">STYLE & CONTEXT INPUTS</span><strong>Dial in the office / occasion brief</strong></div>
      <div className="control-group"><label>Occasion</label><div className="segmented">{["Wedding","Business","Resort","Evening","Casual"].map((x)=><button key={x} className={occasion===x?"active":""} onClick={()=>setOccasion(x)}>{x}</button>)}</div></div>
      <div className="control-group formality"><label>Formality <strong>{formality}/5</strong></label><div className="steps">{[1,2,3,4,5].map((n)=><button key={n} className={n<=formality?"active":""} onClick={()=>setFormality(n)}>{n}</button>)}</div></div>
      <div className="control-group"><label>Time</label><div className="pill-toggle"><button className={time==="Day"?"active":""} onClick={()=>setTime("Day")}><Icon name="sun"/> Day</button><button className={time==="Night"?"active":""} onClick={()=>setTime("Night")}><Icon name="moon"/> Night</button></div></div>
      <div className="control-group"><label>Setting</label><div className="pill-toggle"><button className={setting==="Indoor"?"active":""} onClick={()=>setSetting("Indoor")}>Indoor / AC</button><button className={setting==="Outdoor"?"active":""} onClick={()=>setSetting("Outdoor")}>Outdoor</button></div></div>
      <div className="control-group"><label>Silhouette</label><select value={fit} onChange={(event)=>setFit(event.target.value)}><option>Slim</option><option>Tailored</option><option>Relaxed</option></select></div>
    </section>
  </div>;
}
