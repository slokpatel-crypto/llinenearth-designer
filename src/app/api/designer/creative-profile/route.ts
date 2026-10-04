import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { DEFAULT_CRAFT_PREFERENCES, validCraftPreferences, validCreativeCraft } from "@/lib/designer/creative-spec";
import { CREATIVE_FEEDBACK_REASONS, creativeFamilyFromConceptId } from "@/lib/designer/creative-learning";
import { appendCreativeEvent, readCreativePersonalContext } from "@/lib/designer/creative-profile-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};
export async function GET(request:Request){
  try{
    const identity=await getCustomerIdentity(request);
    if(!identity)return NextResponse.json({authenticated:false,owner:null,configured:false,preferences:DEFAULT_CRAFT_PREFERENCES,reviewCount:0},{headers});
    return NextResponse.json({authenticated:true,owner:identity.id,...await readCreativePersonalContext(identity.id)},{headers});
  }catch{return NextResponse.json({error:"Creative memory is temporarily unavailable."},{status:503,headers});}
}
const rates=new Map<string,{at:number;count:number}>();
export async function POST(request:Request){
  try{
    const identity=await getCustomerIdentity(request);
    if(!identity)return NextResponse.json({error:"Sign in to keep creative preferences on your account."},{status:401,headers});
    if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Same-origin request required."},{status:403,headers});
    const raw=await request.text();
    if(raw.length>16000)return NextResponse.json({error:"Creative review is too large."},{status:413,headers});
    const body=JSON.parse(raw) as Record<string,unknown>;
    // Binding to the subject seen by the UI prevents a delayed review crossing
    // an account switch. The cookie remains the only authority for identity.
    if(body.owner!==identity.id)return NextResponse.json({error:"Your account changed. Refresh creative memory before saving."},{status:409,headers});
    const now=Date.now(),current=rates.get(identity.id);
    if(current&&now-current.at<60000){if(++current.count>30)return NextResponse.json({error:"Please wait before another creative review."},{status:429,headers});}else rates.set(identity.id,{at:now,count:1});
    for(const [id,r] of rates)if(now-r.at>60000)rates.delete(id);
    const context=await readCreativePersonalContext(identity.id);
    if(body.action==="preferences"||body.action==="reset"){
      if(body.action!=="reset"&&!validCraftPreferences(body.preferences))return NextResponse.json({error:"Supported creative preferences are required."},{status:400,headers});
      await appendCreativeEvent("customer_updated",{subtype:"designer_creative_profile",customerId:identity.id,preferences:body.action==="reset"?DEFAULT_CRAFT_PREFERENCES:body.preferences,resetAt:body.action==="reset"?new Date().toISOString():context.resetAt});
    }else if(body.action==="review"){
      if(!context.preferences.enabled)return NextResponse.json({error:"Enable creative memory before saving personal judgements."},{status:409,headers});
      if(typeof body.conceptId!=="string"||body.conceptId.length>220||!body.conceptId.startsWith("creative:")||!["up","down"].includes(String(body.rating))||!validCreativeCraft(body.craft)||!CREATIVE_FEEDBACK_REASONS.some(([r])=>r===body.reason))return NextResponse.json({error:"A valid concept and judgement are required."},{status:400,headers});
      await appendCreativeEvent("designer_feedback",{subtype:"designer_creative_personal_feedback",customerId:identity.id,recommendationId:body.conceptId,creativeConceptId:body.conceptId,creativeFamilyId:creativeFamilyFromConceptId(body.conceptId),rating:body.rating,creativeReason:body.reason,craft:body.craft});
    }else return NextResponse.json({error:"Unsupported creative memory action."},{status:400,headers});
    return NextResponse.json({authenticated:true,owner:identity.id,...await readCreativePersonalContext(identity.id)},{headers});
  }catch{return NextResponse.json({error:"Creative memory could not be saved."},{status:503,headers});}
}
