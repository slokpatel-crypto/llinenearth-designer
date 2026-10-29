import "server-only";

import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";
import type { DesignerFabricMetadata, DesignerFabricMetadataMap } from "@/lib/designer-fabric-metadata-types";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFabricPhysicalEvidenceProvenance } from "@/lib/fabric-physical-provenance";
import { verifyOperatorMetadataPage, OPERATOR_METADATA_PAGE_LIMIT } from "@/lib/designer/metadata-ledger-page";

type MetadataRow = { at:string; payload?:Record<string,unknown> };

function safe(value:unknown,max=180) {
  return String(value ?? "").trim().slice(0,max);
}

function parseMetadata(payload:Record<string,unknown>,at:string):DesignerFabricMetadata|null {
  if (safe(payload.subtype,80) !== "designer_fabric_metadata") return null;
  const fabricId = safe(payload.fabricId,140);
  if (!fabricId || !FABRIC_STOCK.some((item)=>item.id===fabricId)) return null;

  const availability = safe(payload.availability,20);
  const weightClass = safe(payload.weightClass,20);
  const drape = safe(payload.drape,20);
  const rawSeasons = Array.isArray(payload.seasonTags) ? payload.seasonTags.map((item)=>safe(item,30)) : [];
  const rawRoles = Array.isArray(payload.roleTags) ? payload.roleTags.map((item)=>safe(item,30)) : [];

  const weightGsmRaw = Number(payload.weightGsm);
  const formalityRaw = Number(payload.formalityScore);
  const physicalEvidence = normalizeFabricPhysicalEvidenceProvenance(payload.physicalEvidence);

  const seasonTags = rawSeasons.filter((item)=>["Spring","Summer","Autumn","Winter","All-season"].includes(item)) as DesignerFabricMetadata["seasonTags"];
  const roleTags = rawRoles.filter((item)=>["base_safe","accent_safe"].includes(item)) as DesignerFabricMetadata["roleTags"];

  return {
    fabricId,
    availability:["available","unavailable"].includes(availability) ? availability as "available"|"unavailable" : "unknown",
    ...(Number.isFinite(weightGsmRaw) && weightGsmRaw >= 40 && weightGsmRaw <= 1000 ? {weightGsm:Math.round(weightGsmRaw)} : {}),
    ...(["Light","Medium","Heavy"].includes(weightClass) ? {weightClass:weightClass as DesignerFabricMetadata["weightClass"]} : {}),
    ...(safe(payload.weave,100) ? {weave:safe(payload.weave,100)} : {}),
    ...(safe(payload.texture,100) ? {texture:safe(payload.texture,100)} : {}),
    ...(["fluid","soft","medium","structured"].includes(drape) ? {drape:drape as DesignerFabricMetadata["drape"]} : {}),
    ...(seasonTags?.length ? {seasonTags} : {}),
    ...(Number.isFinite(formalityRaw) && formalityRaw >= 1 && formalityRaw <= 5 ? {formalityScore:Math.round(formalityRaw*10)/10} : {}),
    ...(roleTags?.length ? {roleTags} : {}),
    ...(physicalEvidence ? {physicalEvidence} : {}),
    ...(safe(payload.note,500) ? {note:safe(payload.note,500)} : {}),
    verifiedAt:at,
  };
}

/** A missing metadata service is not a verified empty list. Without this
 * distinction a failed lookup can erase an operator's sold-out override while
 * leaving a positive stock ledger row customer-visible.
 */
export type DesignerFabricMetadataRead = {
  metadata:DesignerFabricMetadataMap;
  sourceVerified:boolean;
};

export async function loadDesignerFabricMetadataWithStatus():Promise<DesignerFabricMetadataRead> {
  const unavailable=():DesignerFabricMetadataRead=>({metadata:{},sourceVerified:false});
  const cloud = getSupabaseAdminConfig();
  if (!cloud) return unavailable();

  try {
    // A successful first page is not proof of complete operator history.
    // Every page needs an exact, contiguous PostgREST count receipt under
    // one shared deadline. An incomplete/moving ledger stays unavailable.
    const signal=AbortSignal.timeout(8_000);
    const PAGE_SIZE=OPERATOR_METADATA_PAGE_LIMIT;
    const MAX_PAGES=5;
    const result:DesignerFabricMetadataMap={};
    let expectedTotal:number|null=null;
    for(let page=0;page<MAX_PAGES;page++){
      const offset=page*PAGE_SIZE;
      const params=new URLSearchParams({
        select:"id,at,payload",
        type:"eq.operator_note",
        source:"eq.operator",
        order:"at.desc,id.desc",
        limit:String(PAGE_SIZE),
        offset:String(offset),
      });
      const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
        headers:{...supabaseAdminHeaders(cloud),accept:"application/json",prefer:"count=exact"},
        cache:"no-store",
        signal,
      });
      if(!response.ok){
        console.error("[designer/fabric-metadata] incomplete operator page",response.status,page);
        return unavailable();
      }
      const rows=await response.json() as unknown;
      const receipt=verifyOperatorMetadataPage(
        rows,response.headers.get("content-range"),offset,expectedTotal,PAGE_SIZE,
      );
      if(!Array.isArray(rows)||receipt.status==="invalid"){
        console.error("[designer/fabric-metadata] inconsistent operator metadata page",page);
        return unavailable();
      }
      for(const rawRow of rows){
        if(!rawRow||typeof rawRow!=="object"||Array.isArray(rawRow)
           ||typeof (rawRow as MetadataRow).at!=="string") return unavailable();
        const row=rawRow as MetadataRow;
        if(row.payload!=null && (typeof row.payload!=="object"||Array.isArray(row.payload))) return unavailable();
        const metadata=parseMetadata(row.payload||{},row.at);
        if(!metadata||result[metadata.fabricId]) continue;
        result[metadata.fabricId]=metadata;
      }
      if(receipt.status==="complete") return {metadata:result,sourceVerified:true};
      expectedTotal=receipt.total;
    }
    console.error("[designer/fabric-metadata] operator history exceeds bounded paginated read");
    return unavailable();
  } catch (error) {
    console.error("[designer/fabric-metadata] lookup failed",error);
    return unavailable();
  }
}

/** Compatibility read for operator tooling that displays empty metadata on
 * backend failure. Customer availability must use the status-bearing loader.
 */
export async function loadDesignerFabricMetadata():Promise<DesignerFabricMetadataMap> {
  return (await loadDesignerFabricMetadataWithStatus()).metadata;
}

export function applyDesignerFabricMetadata(fabric:FabricColorway,metadata?:DesignerFabricMetadata):FabricColorway {
  if (!metadata) return fabric;
  const physicalVerified=Boolean(metadata.physicalEvidence);
  return {
    ...fabric,
    ...(physicalVerified && metadata.weightGsm != null ? {weightGsm:metadata.weightGsm} : {}),
    ...(physicalVerified && metadata.weightClass ? {weightClass:metadata.weightClass} : {}),
    ...(metadata.weave ? {weave:metadata.weave} : {}),
    ...(metadata.texture ? {texture:metadata.texture} : {}),
    ...(physicalVerified && metadata.drape ? {drape:metadata.drape} : {}),
    ...(metadata.seasonTags?.length ? {seasonTags:metadata.seasonTags} : {}),
    ...(metadata.formalityScore != null ? {formalityScore:metadata.formalityScore} : {}),
    ...(metadata.roleTags?.length ? {roleTags:metadata.roleTags} : {}),
    ...(metadata.availability === "unavailable" ? {inStock:false} : {}),
  };
}

export function applyDesignerFabricMetadataToStock(map:DesignerFabricMetadataMap) {
  return FABRIC_STOCK.map((fabric)=>applyDesignerFabricMetadata(fabric,map[fabric.id]));
}
