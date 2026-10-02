import "server-only";

import { DESIGNER_STYLE_CHOICES, type DesignerStyle } from "@/lib/designer/engine";
import { GARMENT_OPTION_LIBRARY } from "@/lib/designer/options/library";
import { loadDesignerOptionReviews } from "@/lib/designer/option-reviews";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import type { PreviewOptionReviewStatus } from "@/lib/designer/preview-option-coverage";
import { photoPreviewSupportForChoice } from "@/lib/designer/photo-preview";

export type DesignerPreviewOptionReview={
  id:string;
  status:PreviewOptionReviewStatus;
  note:string;
  reviewedAt:string;
};

type Row={at:string;payload?:Record<string,unknown>};

const STYLE_GROUPS:Partial<Record<keyof DesignerStyle,string>>={
  collar:"shirt.collar",
  cuff:"shirt.cuff",
  placket:"shirt.placket",
  shirtFit:"shirt.fit",
  trouser:"pant.type",
  rise:"pant.rise",
  waistband:"pant.waistband",
  break:"pant.break",
  button:"shirt.button",
};

export function previewOptionId(styleKey:keyof DesignerStyle,label:string){
  const normalized=label.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  return `preview:${styleKey}:${normalized}`;
}

export async function loadDesignerPreviewOptionReviews():Promise<Record<string,DesignerPreviewOptionReview>>{
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {};
  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"2000",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return {};
    const rows=await response.json() as Row[];
    const reviews:Record<string,DesignerPreviewOptionReview>={};
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="designer_preview_option_review") continue;
      const id=String(payload.previewOptionId||"").trim();
      const status=String(payload.status||"") as PreviewOptionReviewStatus;
      if(!id.startsWith("preview:")||!["approved","rejected"].includes(status)||reviews[id]) continue;
      reviews[id]={
        id,status,
        note:String(payload.note||"").trim().slice(0,800),
        reviewedAt:row.at,
      };
    }
    return reviews;
  }catch{
    return {};
  }
}

export async function customerPreviewCoverageRows(){
  const [constructionReviews,previewReviews]=await Promise.all([
    loadDesignerOptionReviews(),
    loadDesignerPreviewOptionReviews(),
  ]);

  const rows=[] as Array<{
    id:string;styleKey:keyof DesignerStyle;label:string;group:string;
    livePreview:"exact"|"approximate"|"none";
    aiRender:"exact"|"approximate"|"none";
    provenance:string;
    supportReason:string;
    constructionStatus:"approved"|"rejected"|"pending"|"not_required";
    previewReview:DesignerPreviewOptionReview|null;
  }>;

  for(const styleKey of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>){
    for(const label of DESIGNER_STYLE_CHOICES[styleKey]){
      const group=STYLE_GROUPS[styleKey]||"synthetic";
      const option=STYLE_GROUPS[styleKey]
        ? GARMENT_OPTION_LIBRARY.find((item)=>item.group===STYLE_GROUPS[styleKey]&&(item.legacyLabel||item.label)===label)
        : null;
      const id=previewOptionId(styleKey,label);
      const constructionStatus=option?.provenance==="owner-provided"
        ? constructionReviews[option.id]?.status||"pending"
        : "not_required";
      const photographicSupport=photoPreviewSupportForChoice(styleKey,label);
      rows.push({
        id,styleKey,label,group,
        livePreview:photographicSupport.status,
        aiRender:option?.renderSupport.aiRender||"approximate",
        provenance:option?.provenance||"built-in-style-control",
        supportReason:photographicSupport.reason,
        constructionStatus,
        previewReview:previewReviews[id]||null,
      });
    }
  }
  return rows;
}
