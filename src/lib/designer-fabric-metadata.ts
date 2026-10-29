import "server-only";

import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";
import type { DesignerFabricMetadata, DesignerFabricMetadataMap } from "@/lib/designer-fabric-metadata-types";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFabricPhysicalEvidenceProvenance } from "@/lib/fabric-physical-provenance";
import { hasCompleteOperatorMetadataPage, OPERATOR_METADATA_PAGE_LIMIT } from "@/lib/designer/metadata-ledger-page";

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
    const params = new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:String(OPERATOR_METADATA_PAGE_LIMIT),
    });
    const response = await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json",prefer:"count=exact"},
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("[designer/fabric-metadata] lookup failed",response.status);
      return unavailable();
    }

    const rows = await response.json() as unknown;
    if(!hasCompleteOperatorMetadataPage(rows,response.headers.get("content-range"))) {
      console.error("[designer/fabric-metadata] operator ledger response missing exact complete row count");
      return unavailable();
    }
    const result:DesignerFabricMetadataMap = {};
    for (const rawRow of rows) {
      if(!rawRow||typeof rawRow!=="object"||Array.isArray(rawRow)
         ||typeof (rawRow as MetadataRow).at!=="string") return unavailable();
      const row=rawRow as MetadataRow;
      // Old operator events may legitimately omit payload; they are not
      // physical metadata. Malformed non-object metadata is not trustworthy.
      if(row.payload!=null && (typeof row.payload!=="object"||Array.isArray(row.payload))) return unavailable();
      const metadata = parseMetadata(row.payload || {},row.at);
      if (!metadata || result[metadata.fabricId]) continue;
      result[metadata.fabricId] = metadata;
    }
    return {metadata:result,sourceVerified:true};
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
