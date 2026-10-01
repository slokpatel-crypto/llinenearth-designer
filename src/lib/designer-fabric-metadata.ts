import "server-only";

import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";
import type { DesignerFabricMetadata, DesignerFabricMetadataMap } from "@/lib/designer-fabric-metadata-types";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFabricPhysicalEvidenceProvenance } from "@/lib/fabric-physical-provenance";

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

export async function loadDesignerFabricMetadata():Promise<DesignerFabricMetadataMap> {
  const cloud = getSupabaseAdminConfig();
  if (!cloud) return {};

  try {
    const params = new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"1000",
    });
    const response = await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if (!response.ok) {
      console.error("[designer/fabric-metadata] lookup failed",response.status);
      return {};
    }

    const rows = await response.json() as MetadataRow[];
    const result:DesignerFabricMetadataMap = {};
    for (const row of rows) {
      const metadata = parseMetadata(row.payload || {},row.at);
      if (!metadata || result[metadata.fabricId]) continue;
      result[metadata.fabricId] = metadata;
    }
    return result;
  } catch (error) {
    console.error("[designer/fabric-metadata] lookup failed",error);
    return {};
  }
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
