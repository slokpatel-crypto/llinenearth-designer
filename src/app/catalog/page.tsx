"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DESIGNER_PANTS, DESIGNER_REVIEWED_PAIRING, DESIGNER_SHIRTS, type DesignerFabric } from "@/lib/designer/engine";
import { catalogHandoffPath } from "@/lib/designer/catalog-handoff";
import { CATALOG_SHORTLIST_LIMIT, catalogFabricCompareRows, reconcileCatalogShortlist, toggleCatalogShortlist, type CatalogGarment } from "@/lib/designer/catalog-shortlist";
import { discoverFabrics, fabricEvidence } from "@/lib/designer/fabric-discovery";
import "./catalog.css";

const INITIAL_LIMIT=12;
function validRows(data:unknown,kind:"shirt"|"pant"):DesignerFabric[] {
  return Array.isArray(data)?data.filter((f):f is DesignerFabric=>
    Boolean(f&&typeof f==="object"&&typeof f.id==="string"&&
      typeof f.name==="string"&&typeof f.image==="string"&&
      Array.isArray(f.allowedGarments)&&f.allowedGarments.includes(kind))):[];
}
export default function FabricCatalogPage(){
  const [shirts,setShirts]=useState<DesignerFabric[]>(DESIGNER_SHIRTS);
  const [pants,setPants]=useState<DesignerFabric[]>(DESIGNER_PANTS);
  const [shirtId,setShirtId]=useState(DESIGNER_REVIEWED_PAIRING.shirtId);
  const [pantId,setPantId]=useState(DESIGNER_REVIEWED_PAIRING.pantId);
  const [shirtQuery,setShirtQuery]=useState("");
  const [pantQuery,setPantQuery]=useState("");
  const [moreShirts,setMoreShirts]=useState(false);
  const [morePants,setMorePants]=useState(false);
  const [shirtCompareIds,setShirtCompareIds]=useState<string[]>([]);
  const [pantCompareIds,setPantCompareIds]=useState<string[]>([]);
  const [catalogStatus,setCatalogStatus]=useState<"loading"|"live"|"fallback">("loading");

  useEffect(()=>{
    let cancelled=false;
    void (async()=>{
      try{
        const response=await fetch("/api/designer/catalog",{cache:"no-store"});
        if(!response.ok)throw Error("Catalogue service unavailable");
        const data=await response.json() as {shirts?:unknown;pants?:unknown};
        const nextShirts=validRows(data.shirts,"shirt");
        const nextPants=validRows(data.pants,"pant");
        if(!nextShirts.length||!nextPants.length)throw Error("Incomplete catalogue");
        if(cancelled)return;
        setShirts(nextShirts);setPants(nextPants);
        setShirtCompareIds(old=>reconcileCatalogShortlist(old,nextShirts,"shirt"));
        setPantCompareIds(old=>reconcileCatalogShortlist(old,nextPants,"pant"));
        setShirtId(old=>nextShirts.some(item=>item.id===old)?old:nextShirts[0].id);
        setPantId(old=>nextPants.some(item=>item.id===old)?old:nextPants[0].id);
        setCatalogStatus("live");
      }catch{if(!cancelled)setCatalogStatus("fallback");}
    })();
    return()=>{cancelled=true;};
  },[]);

  const selectedShirt=shirts.find(item=>item.id===shirtId)||null;
  const selectedPant=pants.find(item=>item.id===pantId)||null;
  const nextHref=catalogHandoffPath(selectedShirt,selectedPant);
  const foundShirts=useMemo(()=>discoverFabrics(shirts,"shirt","All",shirtQuery),[shirts,shirtQuery]);
  const foundPants=useMemo(()=>discoverFabrics(pants,"trouser","All",pantQuery),[pants,pantQuery]);

  function swatches(kind:CatalogGarment,items:DesignerFabric[],selected:string,choose:(id:string)=>void,expanded:boolean,toggle:()=>void,compared:readonly string[],toggleCompare:(id:string)=>void){
    const shown=expanded?items:items.slice(0,INITIAL_LIMIT);
    return <>
      <div className="fabricCatalogSwatches">
        {shown.map(fabric=><div className="fabricCatalogOption" key={fabric.id}>
          <button type="button"
            className={"fabricCatalogSwatch"+(fabric.id===selected?" active":"")}
            aria-pressed={fabric.id===selected}
            aria-label={`Choose ${kind} fabric ${fabric.name}`}
            onClick={()=>choose(fabric.id)}>
            <img src={fabric.image} alt={`${fabric.name} catalogue swatch`} loading="lazy" decoding="async"/>
            <span className="fabricCatalogFabricText"><b>{fabric.name}</b><small>{fabric.line}</small></span>
            {fabric.id===selected&&<span className="fabricCatalogSelected">SELECTED</span>}
          </button>
          <button type="button" className="fabricCatalogCompareToggle"
            aria-pressed={compared.includes(fabric.id)}
            aria-label={`Compare ${kind} fabric ${fabric.name}`}
            disabled={!compared.includes(fabric.id)&&compared.length>=CATALOG_SHORTLIST_LIMIT}
            onClick={()=>toggleCompare(fabric.id)}>
            {compared.includes(fabric.id)?"Remove from comparison":"+ Compare"}
          </button>
        </div>)}
      </div>
      {items.length>INITIAL_LIMIT&&<button type="button" className="fabricCatalogExpand"
        onClick={toggle}>{expanded?"Show fewer fabrics":`Show all ${items.length} ${kind} fabrics`}</button>}
      {!items.length&&<p role="status" className="fabricCatalogEmpty">No matching fabrics. Change or clear your search.</p>}
    </>;
  }

  function comparePanel(garment:CatalogGarment,fabrics:readonly DesignerFabric[],compared:readonly string[],choose:(id:string)=>void,clear:()=>void){
    const candidates=compared.map(id=>fabrics.find(fabric=>fabric.id===id)).filter((fabric):fabric is DesignerFabric=>Boolean(fabric));
    return <section className="fabricCatalogComparePanel" aria-label={garment==="shirt"?"Shirt fabric comparison":"Trouser fabric comparison"}>
      <div className="fabricCatalogCompareHead">
        <div><span>SHORTLIST / {garment==="shirt"?"SHIRTS":"TROUSERS"}</span>
          <h3>Compare before choosing <small>{candidates.length}/{CATALOG_SHORTLIST_LIMIT}</small></h3></div>
        {candidates.length>0&&<button type="button" onClick={clear}>Clear comparison</button>}
      </div>
      {candidates.length===0?<p className="fabricCatalogCompareEmpty">Tap “+ Compare” on any fabric to review up to {CATALOG_SHORTLIST_LIMIT} options side by side. Your selected cloth will not change until you choose one.</p>:
        <div className="fabricCatalogCompareCards">
          {candidates.map(fabric=><article key={fabric.id} className="fabricCatalogCompareCard">
            <img src={fabric.image} alt={`${fabric.name} comparison swatch`} loading="lazy" decoding="async"/>
            <strong>{fabric.name}</strong>
            <dl>{catalogFabricCompareRows(fabric).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
            <button type="button" className="fabricCatalogUseChoice" onClick={()=>choose(fabric.id)}>{`Use this ${garment==="shirt"?"shirt":"trouser"} fabric`}</button>
          </article>)}
        </div>}
      <p className="fabricCatalogCompareDisclaimer">Catalogue details help compare options; they are not independent physical measurements, verified colour matches or guarantees of available metres.</p>
    </section>;
  }

  return <AppShell><main className="fabricCatalogPage">
    <header className="fabricCatalogHero">
      <div>
        <p className="fabricCatalogKicker">LINEN EARTH / FABRIC DISCOVERY</p>
        <h1>Choose the cloth.<br/><em>Then create the look.</em></h1>
        <p>Explore the current shirting and trouser catalogue, choose one of each, then carry the exact fabric IDs into Designer. Your selections are not a stock reservation.</p>
      </div>
      <div className="fabricCatalogHeroImage"><img src="/designer/studio-tucked.webp" alt="Linen Earth studio model with tailored shirt and trousers"/></div>
    </header>
    <section className="fabricCatalogSelection" aria-label="Selected fabric pair">
      <div><span>YOUR PAIR</span><strong>{selectedShirt?.name||"Choose a shirt"} + {selectedPant?.name||"Choose trousers"}</strong>
        <small>{catalogStatus==="loading"?"Loading current catalogue…":catalogStatus==="fallback"?"Preview catalogue only · current stock could not be checked.":"Catalogue loaded · verify physical stock before ordering."}</small>
      </div>
      {nextHref?<Link className="fabricCatalogContinue" href={nextHref}>Start designing with selected fabrics ↗</Link>:<span className="fabricCatalogDisabled">Choose both fabrics to continue</span>}
    </section>
    <div className="fabricCatalogColumns">
      <section className="fabricCatalogPanel" aria-labelledby="catalogShirts">
        <div className="fabricCatalogPanelHead"><span>01 / SHIRT</span><h2 id="catalogShirts">Shirting fabrics</h2><p>Compare colours, patterns and collections before choosing your cloth.</p></div>
        <label className="fabricCatalogSearch">Search shirt fabrics<input type="search" value={shirtQuery} placeholder="Colour, weave, collection…" onChange={e=>{setShirtQuery(e.target.value);setMoreShirts(false);}}/></label>
        <p className="fabricCatalogCount">{foundShirts.length} catalogue matches</p>
        {swatches("shirt",foundShirts,shirtId,setShirtId,moreShirts,()=>setMoreShirts(x=>!x),shirtCompareIds,(id)=>setShirtCompareIds(old=>toggleCatalogShortlist(old,id,shirts,"shirt")))}
        {selectedShirt&&<p className="fabricCatalogEvidence">{fabricEvidence(selectedShirt).stock} · {fabricEvidence(selectedShirt).scale} · {fabricEvidence(selectedShirt).colour}</p>}
        {comparePanel("shirt",shirts,shirtCompareIds,setShirtId,()=>setShirtCompareIds([]))}
      </section>
      <section className="fabricCatalogPanel" aria-labelledby="catalogPants">
        <div className="fabricCatalogPanelHead"><span>02 / TROUSER</span><h2 id="catalogPants">Trouser fabrics</h2><p>Choose a complementary colour and fabric surface for your trousers.</p></div>
        <label className="fabricCatalogSearch">Search trouser fabrics<input type="search" value={pantQuery} placeholder="Colour, weave, collection…" onChange={e=>{setPantQuery(e.target.value);setMorePants(false);}}/></label>
        <p className="fabricCatalogCount">{foundPants.length} catalogue matches</p>
        {swatches("pant",foundPants,pantId,setPantId,morePants,()=>setMorePants(x=>!x),pantCompareIds,(id)=>setPantCompareIds(old=>toggleCatalogShortlist(old,id,pants,"pant")))}
        {selectedPant&&<p className="fabricCatalogEvidence">{fabricEvidence(selectedPant).stock} · {fabricEvidence(selectedPant).scale} · {fabricEvidence(selectedPant).colour}</p>}
        {comparePanel("pant",pants,pantCompareIds,setPantId,()=>setPantCompareIds([]))}
      </section>
    </div>
    <footer className="fabricCatalogFooter">
      <p>Photographs and on-screen colours are visual references. Physical stock, colour, composition, GSM, scale and drape require their own verified evidence.</p>
      {nextHref&&<Link className="fabricCatalogContinue" href={nextHref}>Continue to Designer with this pair ↗</Link>}
      <Link className="fabricCatalogVaultLink" href="/account">Already have a saved look? Open your private vault →</Link>
    </footer>
  </main></AppShell>;
}
