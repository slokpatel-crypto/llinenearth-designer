import "server-only";

import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";
import type { DesignerFabricMetadata, DesignerFabricMetadataMap } from "@/lib/designer-fabric-metadata-types";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFabricPhysicalEvidenceProvenance } from "@/lib/fabric-physical-provenance";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { verifyOperatorMetadataPage, verifyOperatorMetadataRowSequence, validateOperatorMetadataAvailability, literalOperatorPhysicalNumber, literalOperatorPhysicalEnum, literalOperatorText, literalOperatorTags, OPERATOR_METADATA_PAGE_LIMIT, type OperatorMetadataRowCursor } from "@/lib/designer/metadata-ledger-page";

type MetadataRow = { at:string; payload?:Record<string,unknown> };
const CATALOGUE_FABRIC_IDS=new Set(FABRIC_STOCK.map((fabric)=>fabric.id));

function parseMetadata(payload:Record<string,unknown>,at:string):DesignerFabricMetadata|null {
  if (payload.subtype !== "designer_fabric_metadata") return null;
  const fabricId = payload.fabricId;
  if (typeof fabricId !== "string" || !CATALOGUE_FABRIC_IDS.has(fabricId)) return null;

  const availability = payload.availability;
  if (availability !== "unknown" && availability !== "available" && availability !== "unavailable") return null;
  const weightClass = literalOperatorPhysicalEnum(payload.weightClass,["Light","Medium","Heavy"] as const);
  const drape = literalOperatorPhysicalEnum(payload.drape,["fluid","soft","medium","structured"] as const);
  const seasonTags = literalOperatorTags(payload.seasonTags,["Spring","Summer","Autumn","Winter","All-season"] as const);
  const roleTags = literalOperatorTags(payload.roleTags,["base_safe","accent_safe"] as const);
  const weave = literalOperatorText(payload.weave,100);
  const texture = literalOperatorText(payload.texture,100);
  const note = literalOperatorText(payload.note,500);
  const weightGsmRaw = literalOperatorPhysicalNumber(payload.weightGsm,40,1000);
  const formalityRaw = literalOperatorPhysicalNumber(payload.formalityScore,1,5);
  const physicalEvidence = normalizeFabricPhysicalEvidenceProvenance(payload.physicalEvidence);

  return {
    fabricId,
    availability,
    ...(weightGsmRaw !== null ? {weightGsm:Math.round(weightGsmRaw)} : {}),
    ...(weightClass ? {weightClass} : {}),
    ...(weave ? {weave} : {}),
    ...(texture ? {texture} : {}),
    ...(drape ? {drape} : {}),
    ...(seasonTags?.length ? {seasonTags} : {}),
    ...(formalityRaw !== null ? {formalityScore:Math.round(formalityRaw*10)/10} : {}),
    ...(roleTags?.length ? {roleTags} : {}),
    ...(physicalEvidence ? {physicalEvidence} : {}),
    ...(note ? {note} : {}),
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
    let previousRow:OperatorMetadataRowCursor|null=null;
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
      const rows=await readBoundedJsonResponse(response,4 * 1024 * 1024);
      const receipt=verifyOperatorMetadataPage(
        rows,response.headers.get("content-range"),offset,expectedTotal,PAGE_SIZE,
      );
      if(!Array.isArray(rows)||receipt.status==="invalid"){
        console.error("[designer/fabric-metadata] inconsistent operator metadata page",page);
        return unavailable();
      }
      // Content-Range/count can remain unchanged while offset pages repeat
      // a row and omit a sold-out override. Check the actual stable ordering.
      const lastRow=verifyOperatorMetadataRowSequence(rows,previousRow);
      if(rows.length>0&&!lastRow){
        console.error("[designer/fabric-metadata] shifted or unordered operator page",page);
        return unavailable();
      }
      previousRow=lastRow;
      for(const rawRow of rows){
        if(!rawRow||typeof rawRow!=="object"||Array.isArray(rawRow)
           ||typeof (rawRow as MetadataRow).at!=="string") return unavailable();
        const row=rawRow as MetadataRow;
        if(row.payload!=null && (typeof row.payload!=="object"||Array.isArray(row.payload))) return unavailable();
        const status=validateOperatorMetadataAvailability(row.payload,CATALOGUE_FABRIC_IDS);
        if(status==="invalid"){
          console.error("[designer/fabric-metadata] malformed operator availability evidence",page);
          return unavailable();
        }
        if(status==="unrelated") continue;
        const metadata=parseMetadata(row.payload!,row.at);
        if(!metadata) return unavailable();
        if(result[metadata.fabricId]) continue;
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
