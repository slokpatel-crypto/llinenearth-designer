"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DESIGNER_PANTS, DESIGNER_REVIEWED_PAIRING, DESIGNER_SHIRTS, type DesignerFabric } from "@/lib/designer/engine";
import { catalogHandoffPath } from "@/lib/designer/catalog-handoff";
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

  function swatches(kind:"shirt"|"pant",items:DesignerFabric[],selected:string,choose:(id:string)=>void,expanded:boolean,toggle:()=>void){
    const shown=expanded?items:items.slice(0,INITIAL_LIMIT);
    return <>
      <div className="fabricCatalogSwatches">
        {shown.map(fabric=><button type="button" key={fabric.id}
          className={"fabricCatalogSwatch"+(fabric.id===selected?" active":"")}
          aria-pressed={fabric.id===selected}
          aria-label={`Choose ${kind} fabric ${fabric.name}`}
          onClick={()=>choose(fabric.id)}>
          <img src={fabric.image} alt={`${fabric.name} catalogue swatch`} loading="lazy" decoding="async"/>
          <span className="fabricCatalogFabricText"><b>{fabric.name}</b><small>{fabric.line}</small></span>
          {fabric.id===selected&&<span className="fabricCatalogSelected">SELECTED</span>}
        </button>)}
      </div>
      {items.length>INITIAL_LIMIT&&<button type="button" className="fabricCatalogExpand"
        onClick={toggle}>{expanded?"Show fewer fabrics":`Show all ${items.length} ${kind} fabrics`}</button>}
      {!items.length&&<p role="status" className="fabricCatalogEmpty">No matching fabrics. Change or clear your search.</p>}
    </>;
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
        {swatches("shirt",foundShirts,shirtId,setShirtId,moreShirts,()=>setMoreShirts(x=>!x))}
        {selectedShirt&&<p className="fabricCatalogEvidence">{fabricEvidence(selectedShirt).stock} · {fabricEvidence(selectedShirt).scale} · {fabricEvidence(selectedShirt).colour}</p>}
      </section>
      <section className="fabricCatalogPanel" aria-labelledby="catalogPants">
        <div className="fabricCatalogPanelHead"><span>02 / TROUSER</span><h2 id="catalogPants">Trouser fabrics</h2><p>Choose a complementary colour and fabric surface for your trousers.</p></div>
        <label className="fabricCatalogSearch">Search trouser fabrics<input type="search" value={pantQuery} placeholder="Colour, weave, collection…" onChange={e=>{setPantQuery(e.target.value);setMorePants(false);}}/></label>
        <p className="fabricCatalogCount">{foundPants.length} catalogue matches</p>
        {swatches("pant",foundPants,pantId,setPantId,morePants,()=>setMorePants(x=>!x))}
        {selectedPant&&<p className="fabricCatalogEvidence">{fabricEvidence(selectedPant).stock} · {fabricEvidence(selectedPant).scale} · {fabricEvidence(selectedPant).colour}</p>}
      </section>
    </div>
    <footer className="fabricCatalogFooter">
      <p>Photographs and on-screen colours are visual references. Physical stock, colour, composition, GSM, scale and drape require their own verified evidence.</p>
      {nextHref&&<Link className="fabricCatalogContinue" href={nextHref}>Continue to Designer with this pair ↗</Link>}
      <Link className="fabricCatalogVaultLink" href="/account">Already have a saved look? Open your private vault →</Link>
    </footer>
  </main></AppShell>;
}
