import type { DesignerFabric } from "./engine.ts";

/**
 * Customer-facing fabric discovery. All search/filtering is local and
 * deterministic: no credits, no synthetic swatches, no inferred stock or GSM.
 * Filtering NEVER changes the customer's locked garment choice.
 */
export type ShirtFabricFamily = "All" | "Plain" | "Print" | "Blend" | "Formal";
export type TrouserFabricTone = "All" | "Light" | "Medium" | "Dark";
export const SHIRT_FABRIC_FAMILIES:readonly ShirtFabricFamily[] =
  ["All","Plain","Print","Blend","Formal"];
export const TROUSER_FABRIC_TONES:readonly TrouserFabricTone[] =
  ["All","Light","Medium","Dark"];

export function fabricFamily(fabric:Pick<DesignerFabric,"line"|"patternType">):Exclude<ShirtFabricFamily,"All"> {
  const line=fabric.line.toLowerCase();
  const pattern=fabric.patternType.toLowerCase();
  if(line.includes("formal shirting")) return "Formal";
  if(line.includes("blend")) return "Blend";
  if(line.includes("print") || /print|floral|botanical|geometric/.test(pattern)) return "Print";
  return "Plain";
}

function normalize(value:string):string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g," ").trim();
}

/** Multi-term case/accent-insensitive search over authored stock metadata only. */
export function fabricMatchesSearch(fabric:DesignerFabric,query:string):boolean {
  const terms=normalize(query).split(/\s+/).filter(Boolean).slice(0,12);
  if(terms.length===0) return true;
  const index=normalize([
    fabric.id,fabric.name,fabric.line,fabric.patternType,
    fabric.colorFamily||"",fabric.tone||"",fabric.source,
    fabric.weave||"",
  ].join(" "));
  return terms.every(term=>index.includes(term));
}

export function discoverFabrics(
  fabrics:readonly DesignerFabric[],
  kind:"shirt"|"trouser",
  filter:ShirtFabricFamily|TrouserFabricTone,
  query="",
):DesignerFabric[] {
  return fabrics.filter(fabric=>
    fabric.allowedGarments.includes(kind==="shirt"?"shirt":"pant")
    &&(filter==="All"||(kind==="shirt"
      ?fabricFamily(fabric)===filter
      :fabric.tone===filter))
    &&fabricMatchesSearch(fabric,query)
  );
}

export function fabricFilterCounts(fabrics:readonly DesignerFabric[],kind:"shirt"|"trouser",query="") {
  const categories=kind==="shirt"?SHIRT_FABRIC_FAMILIES:TROUSER_FABRIC_TONES;
  return Object.fromEntries(categories.map(category=>[
    category,discoverFabrics(fabrics,kind,category,query).length,
  ])) as Record<string,number>;
}

/** Evidence descriptors do NOT convert a nominal catalogue entry into a verified measurement. */
export function fabricEvidence(fabric:DesignerFabric):{
  stock:string;scale:string;colour:string;weight:string;
} {
  return {
    stock:fabric.availabilityVerified===true?"Stock checked":"Confirm stock",
    scale:fabric.patternScaleVerified===true?"Pattern scale measured":"Scale not measured",
    colour:fabric.colorVerified===true?"Colour checked":"Colour is a screen estimate",
    weight:typeof fabric.weightGsm==="number"&&Number.isFinite(fabric.weightGsm)&&fabric.weightGsm>0
      ?`${fabric.weightGsm} GSM (catalogue)`:"Weight not measured",
  };
}
