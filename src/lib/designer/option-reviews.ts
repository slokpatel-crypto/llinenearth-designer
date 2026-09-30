import "server-only";

import { GARMENT_OPTION_LIBRARY, optionById } from "@/lib/designer/options/library";
import type { StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export type DesignerOptionReviewStatus="approved"|"rejected";
export type DesignerOptionReview={
  optionId:string;
  status:DesignerOptionReviewStatus;
  note:string;
  reviewedAt:string;
};

type Row={at:string;payload?:Record<string,unknown>};

export async function loadDesignerOptionReviews():Promise<Record<string,DesignerOptionReview>> {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {};
  try {
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"1500",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return {};
    const rows=await response.json() as Row[];
    const validIds=new Set(GARMENT_OPTION_LIBRARY.map((option)=>option.id));
    const reviews:Record<string,DesignerOptionReview>={};
    for(const row of rows) {
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="designer_option_review") continue;
      const optionId=String(payload.optionId||"").trim();
      const status=String(payload.status||"") as DesignerOptionReviewStatus;
      if(!validIds.has(optionId) || !["approved","rejected"].includes(status) || reviews[optionId]) continue;
      reviews[optionId]={
        optionId,
        status,
        note:String(payload.note||"").trim().slice(0,600),
        reviewedAt:row.at,
      };
    }
    return reviews;
  } catch {
    return {};
  }
}

export function selectedOwnerProvidedOptions(spec:StyleSpecV2) {
  const ids=[...new Set([...Object.values(spec.shirt),...Object.values(spec.pant)])];
  return ids
    .map((id)=>optionById(String(id)))
    .filter((option):option is NonNullable<ReturnType<typeof optionById>>=>Boolean(option?.provenance==="owner-provided"));
}

export function rejectedConstructionOptions(
  spec:StyleSpecV2,
  reviews:Record<string,DesignerOptionReview>,
) {
  return selectedOwnerProvidedOptions(spec)
    .filter((option)=>reviews[option.id]?.status==="rejected")
    .map((option)=>({id:option.id,label:option.label,group:option.group}));
}
