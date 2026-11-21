import type { DesignerFabric } from "./engine.ts";
import { fabricEvidence } from "./fabric-discovery.ts";

export const CATALOG_SHORTLIST_LIMIT=3;
export type CatalogGarment="shirt"|"pant";

function validFabricFor(fabric:DesignerFabric,garment:CatalogGarment):boolean {
  return typeof fabric.id==="string"&&fabric.id.length>0 &&
    Array.isArray(fabric.allowedGarments)&&fabric.allowedGarments.includes(garment);
}

/** Keep only current, unique, category-correct IDs. Never keep stale catalogue rows. */
export function reconcileCatalogShortlist(
  current:readonly string[],
  fabrics:readonly DesignerFabric[],
  garment:CatalogGarment,
):string[] {
  const valid=new Set(fabrics.filter(f=>validFabricFor(f,garment)).map(f=>f.id));
  return [...new Set(current.filter(id=>typeof id==="string"&&valid.has(id)))]
    .slice(0,CATALOG_SHORTLIST_LIMIT);
}

/** Toggle a single fabric, preserving selection order and rejecting unsupported IDs. */
export function toggleCatalogShortlist(
  current:readonly string[],
  id:string,
  fabrics:readonly DesignerFabric[],
  garment:CatalogGarment,
):string[] {
  const clean=reconcileCatalogShortlist(current,fabrics,garment);
  if(!fabrics.some(f=>f.id===id&&validFabricFor(f,garment)))return clean;
  if(clean.includes(id))return clean.filter(value=>value!==id);
  return clean.length<CATALOG_SHORTLIST_LIMIT?[...clean,id]:clean;
}

/** Read-only comparison. Catalogue claims are not upgraded to measured physical facts. */
export function catalogFabricCompareRows(fabric:DesignerFabric):Array<{label:string;value:string}> {
  const evidence=fabricEvidence(fabric);
  const text=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():"Not classified";
  const material=fabric.fiberContent
    ?fabric.fiberContentVerified===true
      ?fabric.fiberContent+" · verified"
      :fabric.fiberContent+" · unverified catalogue description"
    :"Composition not verified";
  return [
    {label:"Collection",value:text(fabric.line)},
    {label:"Colour family",value:text(fabric.colorFamily)},
    {label:"Tone",value:text(fabric.tone)},
    {label:"Pattern",value:text(fabric.patternType)},
    {label:"Weave",value:text(fabric.weave)},
    {label:"Material",value:material},
    {label:"Fabric weight",value:evidence.weight},
    {label:"Availability",value:evidence.stock},
    {label:"Pattern scale",value:evidence.scale},
    {label:"Colour accuracy",value:evidence.colour},
  ];
}
