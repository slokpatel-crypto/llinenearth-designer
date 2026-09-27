"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { FABRIC_STOCK, fabricProfileFromStock, type FabricColorway } from "@/lib/fabric-stock";
import type { ContextProfile, DesignerBrief } from "@/lib/designer-types";
import type { StockPairingPublic } from "@/lib/shirt-pant-designer";

type GarmentFilter = "all" | "shirt" | "trouser";
type LabState = "idle" | "designing" | "results" | "error";

const OCCASIONS = ["Business","Dinner / evening","Wedding","Smart casual","Resort / holiday","Festive / cultural"];
const FORMALITIES = ["Relaxed","Smart relaxed","Refined","Formal","Ceremonial / evening formal"];
const TIMES = ["Daytime","Late afternoon","Evening","Late night"];
const VENUES = ["Office / boardroom","Restaurant / club","Luxury hotel","Garden / lawn","Beach / coast","Outdoor city"];
const AESTHETICS = ["Quiet Luxury","Modern Classic","Italian-Inspired","Minimal","Resort Luxury","Contemporary Indian"];
const FITS = ["Tailored","Straight","Clean slim","Relaxed","Soft / fluid"];

function environmentFromVenue(venue:string) {
  if (venue.includes("Beach")) return "Hot / humid outdoor";
  if (venue.includes("Garden") || venue.includes("Outdoor")) return "Mostly outdoor";
  if (venue.includes("Office")) return "Indoor / air-conditioned";
  return "Mostly indoor";
}

function impressionFromAesthetic(aesthetic:string) {
  if (aesthetic === "Quiet Luxury") return "Quiet confidence";
  if (aesthetic === "Italian-Inspired") return "Relaxed sophistication";
  if (aesthetic === "Contemporary Indian") return "Traditional refinement";
  if (aesthetic === "Minimal") return "Quiet confidence";
  return "Sharp and powerful";
}

function category(fabric:FabricColorway) {
  const shirt = fabric.suitableFor.includes("shirt");
  const trouser = fabric.suitableFor.includes("trouser");
  if (shirt && trouser) return "Shirt / Trouser";
  if (shirt) return "Shirt";
  if (trouser) return "Trouser";
  return fabric.suitableFor.join(" / ");
}

export function DesignerLab() {
  const [filter,setFilter] = useState<GarmentFilter>("all");
  const [search,setSearch] = useState("");
  const [line,setLine] = useState("All collections");
  const [selected,setSelected] = useState<FabricColorway | null>(null);
  const [occasion,setOccasion] = useState("Dinner / evening");
  const [formality,setFormality] = useState("Refined");
  const [time,setTime] = useState("Evening");
  const [venue,setVenue] = useState("Restaurant / club");
  const [aesthetic,setAesthetic] = useState("Quiet Luxury");
  const [fit,setFit] = useState("Tailored");
  const [state,setState] = useState<LabState>("idle");
  const [results,setResults] = useState<StockPairingPublic[]>([]);
  const [error,setError] = useState("");
  const [chosenId,setChosenId] = useState("");

  const lines = useMemo(()=>["All collections",...Array.from(new Set(
    FABRIC_STOCK.filter((item)=>item.inStock).map((item)=>item.line)
  )).sort()],[]);

  const visible = useMemo(()=>{
    const q = search.trim().toLowerCase();
    return FABRIC_STOCK.filter((fabric)=>{
      if (!fabric.inStock) return false;
      if (filter === "shirt" && !fabric.suitableFor.includes("shirt")) return false;
      if (filter === "trouser" && !fabric.suitableFor.includes("trouser")) return false;
      if (line !== "All collections" && fabric.line !== line) return false;
      if (!q) return true;
      return [fabric.colorName,fabric.line,fabric.pattern,fabric.family].some((value)=>value.toLowerCase().includes(q));
    });
  },[filter,line,search]);

  async function design() {
    if (!selected) return;
    setState("designing");
    setError("");
    setResults([]);
    setChosenId("");

    const context:ContextProfile = {
      occasion,
      venue,
      time,
      environment:environmentFromVenue(venue),
      formality,
      impression:impressionFromAesthetic(aesthetic),
      fit,
      aesthetic,
    };

    const brief:DesignerBrief = {
      sessionId:`LE-LAB-${crypto.randomUUID()}`,
      fabric:{
        profile:fabricProfileFromStock(selected),
        materialOverride:selected.family,
        toneOverride:selected.colorName,
        source:"stock",
        stockId:selected.id,
        swatchImageUrl:selected.swatchImageUrl,
      },
      context,
    };

    try {
      const response = await fetch("/api/designer/generate",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(brief),
      });
      const data = await response.json() as {error?:string;stockPairings?:StockPairingPublic[];stockPairing?:StockPairingPublic|null};
      if (!response.ok) throw new Error(data.error || "Designer could not create a result.");

      const ranked = Array.isArray(data.stockPairings) && data.stockPairings.length
        ? data.stockPairings.filter(Boolean)
        : data.stockPairing
          ? [data.stockPairing]
          : [];

      setResults(ranked);
      setChosenId(ranked[0]?.id || "");
      setState("results");
      window.requestAnimationFrame(()=>document.getElementById("lab-results")?.scrollIntoView({behavior:"smooth",block:"start"}));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Designer could not create a result.");
      setState("error");
    }
  }

  function reset() {
    setSelected(null);
    setResults([]);
    setChosenId("");
    setState("idle");
    setSearch("");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  const chosen = results.find((item)=>item.id === chosenId) || results[0] || null;

  return <main className="designerLab">
    <header className="labHeader">
      <div>
        <span className="labMark">LLINEN EARTH</span>
        <b>DESIGNER LAB</b>
      </div>
      <div className="labHeaderMeta">
        <span>REAL STOCK</span>
        <span>SHIRT + TROUSER</span>
        <span>{FABRIC_STOCK.filter((item)=>item.inStock).length} FABRICS</span>
      </div>
      <button onClick={reset}>New design</button>
    </header>

    <section className="labHero">
      <p>DESIGNER WORKSPACE / V1</p>
      <h1>Choose cloth.<br/>See what the Designer would do.</h1>
      <span>No marketing journey. No extra screens. Real LLinen Earth fabrics in, ranked outfit directions out.</span>
    </section>

    <section className="labWorkspace">
      <div className="labSectionHead">
        <div><span>01</span><h2>Choose the cloth</h2></div>
        <p>Select the fabric you want the Designer to treat as the anchor.</p>
      </div>

      <div className="labFabricTools">
        <div className="labTabs">
          {(["all","shirt","trouser"] as GarmentFilter[]).map((item)=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item === "all" ? "All fabrics" : item === "shirt" ? "Shirts" : "Trousers"}</button>)}
        </div>
        <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search colour, pattern or collection" />
        <select value={line} onChange={(event)=>setLine(event.target.value)}>
          {lines.map((item)=><option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="labFabricGrid">
        {visible.map((fabric)=><button key={fabric.id} className={selected?.id===fabric.id?"labFabricCard selected": "labFabricCard"} onClick={()=>{setSelected(fabric);setResults([]);setState("idle");}}>
          <span className="labFabricImage"><Image fill sizes="(max-width: 700px) 46vw, 190px" src={fabric.swatchImageUrl} alt={`${fabric.colorName} ${fabric.pattern} fabric`} /></span>
          <span className="labFabricCopy">
            <small>{category(fabric)}</small>
            <strong>{fabric.colorName}</strong>
            <em>{fabric.pattern}</em>
            <i>{fabric.line}</i>
          </span>
        </button>)}
      </div>
    </section>

    <section className={selected ? "labBrief ready" : "labBrief"}>
      <div className="labSectionHead">
        <div><span>02</span><h2>Give it a situation</h2></div>
        <p>Only the signals that materially change the outfit.</p>
      </div>

      {selected ? <div className="labBriefGrid">
        <aside className="labAnchor">
          <span className="labAnchorImage"><Image fill sizes="240px" src={selected.swatchImageUrl} alt={selected.colorName} /></span>
          <small>YOUR ANCHOR FABRIC</small>
          <h3>{selected.colorName}</h3>
          <p>{selected.line}</p>
          <div><span>{selected.family}</span><span>{selected.pattern}</span><span>{category(selected)}</span></div>
        </aside>

        <div className="labControls">
          <label><span>Occasion</span><select value={occasion} onChange={(event)=>setOccasion(event.target.value)}>{OCCASIONS.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Formality</span><select value={formality} onChange={(event)=>setFormality(event.target.value)}>{FORMALITIES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Time</span><select value={time} onChange={(event)=>setTime(event.target.value)}>{TIMES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Setting</span><select value={venue} onChange={(event)=>setVenue(event.target.value)}>{VENUES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Style</span><select value={aesthetic} onChange={(event)=>setAesthetic(event.target.value)}>{AESTHETICS.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Fit</span><select value={fit} onChange={(event)=>setFit(event.target.value)}>{FITS.map((item)=><option key={item}>{item}</option>)}</select></label>

          <button className="labDesignButton" onClick={()=>void design()} disabled={state==="designing"}>
            <span>{state==="designing" ? "Designer is checking the stock…" : "Ask the Designer"}</span>
            <b>{state==="designing" ? "CR-1 → CR-7" : "Create directions →"}</b>
          </button>
          {error && <p className="labError">{error}</p>}
        </div>
      </div> : <div className="labEmptyBrief">Choose one fabric above. The brief opens here.</div>}
    </section>

    {(state === "results" || state === "error") && <section className="labResults" id="lab-results">
      <div className="labSectionHead">
        <div><span>03</span><h2>Designer output</h2></div>
        <p>{results.length > 1 ? "Three different ways forward from the same cloth." : "The Designer only shows combinations it can defend."}</p>
      </div>

      {results.length ? <>
        <div className="labResultGrid">
          {results.map((pair)=><button key={pair.id} className={chosen?.id===pair.id?"labResultCard selected": "labResultCard"} onClick={()=>setChosenId(pair.id)}>
            <div className="labResultTop"><span>{pair.mode || "Direction"}</span><strong>{pair.rankScore ?? pair.confidenceScore}<small>/100</small></strong></div>
            <div className="labPairVisual">
              <div><span><Image fill sizes="180px" src={pair.shirt.swatchImageUrl} alt={pair.shirt.colorName} /></span><small>SHIRT</small><b>{pair.shirt.colorName}</b><em>{pair.shirt.line}</em></div>
              <i>+</i>
              <div><span><Image fill sizes="180px" src={pair.trouser.swatchImageUrl} alt={pair.trouser.colorName} /></span><small>TROUSER</small><b>{pair.trouser.colorName}</b><em>{pair.trouser.line}</em></div>
            </div>
            <div className="labResultReason">
              <small>{pair.occasionBand} · {pair.relationship}</small>
              <p>{pair.customerReason}</p>
              {pair.modeReason && <em>{pair.modeReason}</em>}
            </div>
          </button>)}
        </div>

        {chosen && <div className="labChosen">
          <div>
            <span>SELECTED DIRECTION</span>
            <h3>{chosen.mode || "Designer direction"}</h3>
            <p>{chosen.shirt.colorName} shirt + {chosen.trouser.colorName} trouser</p>
          </div>
          <div className="labChosenFacts">
            <span><small>Confidence</small><b>{chosen.confidenceScore}/100</b></span>
            <span><small>Relationship</small><b>{chosen.relationship}</b></span>
            <span><small>Occasion band</small><b>{chosen.occasionBand}</b></span>
            <span><small>Rule set</small><b>{chosen.rulesVersion}</b></span>
          </div>
          <p>{chosen.customerReason}</p>
        </div>}
      </> : <div className="labNoResult"><strong>No safe direction was forced.</strong><p>The engine held the result because the available stock did not clear the current confidence/rule threshold for this brief.</p></div>}
    </section>}

    <footer className="labFooter">
      <span>LLINEN EARTH DESIGNER LAB</span>
      <p>Focused testing surface for the shared LLinen Earth Designer intelligence.</p>
    </footer>
  </main>;
}
