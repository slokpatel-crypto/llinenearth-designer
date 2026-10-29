import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { parseCustomerProductionRecordId } from "@/lib/designer/customer-production-outcomes";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeCustomerOutcomePolicy,
  normalizeCustomerOutcomeReview,
  summarizeCustomerOutcomeLearning,
  type CustomerOutcomeEvidenceRow,
  type CustomerOutcomePolicyRow,
  type CustomerOutcomeReviewRow,
} from "@/lib/designer/customer-outcome-learning";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Customer outcome backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,300);
    throw new Error(`Customer outcome request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()){
    return NextResponse.json({
      configured:false,outcomes:[],reviews:[],policies:[],
      summary:summarizeCustomerOutcomeLearning([],[],[]),
    });
  }
  try{
    const [outcomes,reviews,policies]=await Promise.all([
      rpc<CustomerOutcomeEvidenceRow[]>("production_customer_outcome_learning_list",{p_limit:1000}),
      rpc<CustomerOutcomeReviewRow[]>("production_customer_outcome_review_list",{p_limit:5000}),
      rpc<CustomerOutcomePolicyRow[]>("production_customer_outcome_policy_list",{p_limit:100}),
    ]);
    return NextResponse.json({
      configured:true,outcomes,reviews,policies,
      summary:summarizeCustomerOutcomeLearning(outcomes,reviews,policies),
    },{headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
  }catch(error){
    console.error("[operator/customer-outcomes]",error);
    return NextResponse.json({error:"Customer outcome evidence could not be loaded."},{status:503});
  }
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="review"){
      let review;
      try{review=normalizeCustomerOutcomeReview(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid customer outcome review."},400);}
      const reviewId=await rpc<unknown>("production_customer_outcome_review_record",{
        p_outcome_id:review.outcomeId,
        p_decision:review.decision,
        p_reviewer:review.reviewer,
        p_note:review.note,
      });
      const confirmedId=parseCustomerProductionRecordId(reviewId);
      if(!confirmedId) return respond({error:"Customer outcome review could not be confirmed."},409);
      return respond({reviewId:confirmedId});
    }

    if(body.action==="policy"){
      let policy;
      try{policy=normalizeCustomerOutcomePolicy(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid customer outcome policy."},400);}
      const policyId=await rpc<unknown>("production_customer_outcome_policy_record",{
        p_minimum_approved_cases:policy.minimumApprovedCases,
        p_approved_by:policy.approvedBy,
        p_note:policy.note,
      });
      const confirmedId=parseCustomerProductionRecordId(policyId);
      if(!confirmedId) return respond({error:"Customer outcome policy could not be confirmed."},409);
      return respond({policyId:confirmedId});
    }
    return respond({error:"Unsupported customer-outcome action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/customer-outcomes]",error);
    return respond({error:"Customer outcome operation failed."},409);
  }
}
