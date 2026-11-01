import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeProductionQuoteDraft } from "@/lib/designer/production-quote";
import { parseDesignVaultRecoveryToken } from "@/lib/designer/design-vault";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { buildProductionLearningContext } from "@/lib/designer/production-learning-context";
import {secureJsonRequestError,readSecureJsonObject,SecureJsonBodyTooLarge,SecureJsonBodyInvalid} from "@/lib/secure-json-request";
import {safeOperatorProductionErrorCode} from "@/lib/designer/operator-production-error";
import {readBoundedJsonResponse} from "@/lib/designer/bounded-json-response";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Production backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    // Never collect or include PostgREST error bodies: they can contain SQL,
    // recovery tokens, customer details or supplier-pricing information.
    throw new Error("Production upstream request failed.");
  }
  // Enforce an actual stream bound independently of Content-Length.
  // SQL lists can be larger than single mutation receipts, but not unlimited.
  const maxBytes=name.endsWith("_list")?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

async function loadVerifiedLockedRevision(recoveryToken:string){
  const parsed=parseDesignVaultRecoveryToken(recoveryToken);
  if(!parsed) throw new Error("A valid locked-design recovery token is required.");
  const rows=await rpc<Array<{payload:LockedDesignRevision}>>("designer_locked_revision_vault_get",{
    p_vault_id:parsed.vaultId,
    p_access_hash:parsed.accessHash,
  });
  const revision=rows[0]?.payload;
  if(!revision||!await verifyLockedDesignRevision(revision)){
    throw new Error("The locked design could not be verified for production.");
  }
  return revision;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,quotes:[],orders:[]});
  try{
    const [quotes,orders]=await Promise.all([
      rpc("production_quote_list",{p_limit:100}),
      rpc("production_order_list",{p_limit:100}),
    ]);
    let qcInspections:unknown[]=[];
    let customerOutcomes:unknown[]=[];
    let learningContexts:unknown[]=[];
    try{
      qcInspections=await rpc<unknown[]>("finished_garment_qc_list",{p_limit:250});
    }catch{
      // Keep quote/order operations readable while a new QC migration is being installed.
    }
    try{
      customerOutcomes=await rpc<unknown[]>("production_customer_outcome_list",{p_limit:250});
    }catch{
      // Keep the production desk usable while the Phase 11 outcome migration is being installed.
    }
    try{
      learningContexts=await rpc<unknown[]>("production_order_learning_context_list",{p_limit:500});
    }catch{
      // Older/manual orders remain readable while durable lineage support is being installed.
    }
    return NextResponse.json({configured:true,quotes,orders,qcInspections,customerOutcomes,learningContexts},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/production]",safeOperatorProductionErrorCode(error));
    return NextResponse.json({error:"Production records could not be read."},{status:503,headers:{"cache-control":"private, no-store"}});
  }
}

// Uniform no-store policy for every authenticated or rejected production POST,
// including otherwise harmless unsupported actions and successful receipts.
function privateProductionResponse(body:unknown,init?:ResponseInit){
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store");
  return response;
}

export async function POST(request:Request){
  if(!await authorized()) return privateProductionResponse({error:"Unauthorized."},{status:401,headers:{"cache-control":"private, no-store"}});
  // Reject cross-origin browser writes, invalid media types and oversized
  // request declarations before the first backend RPC or any body read.
  const early=secureJsonRequestError(request,65_536);
  if(early)return privateProductionResponse({error:early.error},{status:early.status,headers:{"cache-control":"private, no-store"}});
  try{
    // Enforce the real decoded stream length even if Content-Length is absent
    // or inaccurate. Never parse attacker-controlled JSON with request.json().
    const body=await readSecureJsonObject(request,65_536);
    const action=String(body.action||"");
    if(action==="create_quote"){
      const revisionId=String(body.revisionId||"").trim();
      const recipeHash=String(body.recipeHash||"").trim().toLowerCase();
      const note=String(body.note||"").slice(0,1000);
      const recoveryToken=String(body.recoveryToken||"").trim();
      if(revisionId.length<12||!/^[a-f0-9]{64}$/.test(recipeHash)) {
        return privateProductionResponse({error:"Locked revision and recipe hash are required."},{status:400});
      }
      const revision=await loadVerifiedLockedRevision(recoveryToken);
      if(revision.revisionId!==revisionId||revision.recipeHash.toLowerCase()!==recipeHash){
        return privateProductionResponse({error:"The verified locked design does not match the quote revision/hash."},{status:409});
      }
      const draft=normalizeProductionQuoteDraft({
        currency:body.currency,
        lineItems:body.lineItems,
        adjustment:body.adjustment,
      });
      const quoteId=await rpc<string>("production_quote_create",{
        p_revision_id:revisionId,p_recipe_hash:recipeHash,p_currency:draft.currency,
        p_line_items:draft.lineItems,p_adjustment:draft.adjustment,p_note:note,
      });
      return privateProductionResponse({quoteId,lockedRevisionVerified:true});
    }
    if(action==="quote_status"){
      const quoteId=String(body.quoteId||"");
      const status=String(body.status||"");
      const note=String(body.note||"").slice(0,1000);
      const updated=await rpc<boolean>("production_quote_set_status",{p_quote_id:quoteId,p_status:status,p_note:note});
      return privateProductionResponse({updated:Boolean(updated)});
    }
    if(action==="create_order"){
      const revisionId=String(body.revisionId||"").trim();
      const recipeHash=String(body.recipeHash||"").trim().toLowerCase();
      const quoteId=String(body.quoteId||"").trim()||null;
      const note=String(body.note||"").slice(0,1000);
      const recoveryToken=String(body.recoveryToken||"").trim();
      if(revisionId.length<12||!/^[a-f0-9]{64}$/.test(recipeHash)) {
        return privateProductionResponse({error:"Locked revision and recipe hash are required."},{status:400});
      }
      const revision=await loadVerifiedLockedRevision(recoveryToken);
      if(revision.revisionId!==revisionId||revision.recipeHash.toLowerCase()!==recipeHash){
        return privateProductionResponse({error:"The verified locked design does not match the order revision/hash."},{status:409});
      }
      const orderId=await rpc<string>("production_order_create_with_context",{
        p_revision_id:revisionId,
        p_recipe_hash:recipeHash,
        p_quote_id:quoteId,
        p_note:note,
        p_context:buildProductionLearningContext(revision),
      });
      return privateProductionResponse({orderId,learningContextAttached:true,lockedRevisionVerified:true});
    }
    if(action==="order_status"){
      const orderId=String(body.orderId||"");
      const status=String(body.status||"");
      const note=String(body.note||"").slice(0,1000);
      if(status==="delivered"){
        let inspections:Array<{order_id:string;decision:string;inspector?:string;inspection_reference?:string}>=[];
        try{
          inspections=await rpc<Array<{order_id:string;decision:string;inspector?:string;inspection_reference?:string}>>("finished_garment_qc_list",{p_limit:500});
        }catch{
          return privateProductionResponse({error:"Finished-garment QC backend must be installed before delivery can be recorded."},{status:409});
        }
        const latest=inspections.find((item)=>item.order_id===orderId);
        if(latest?.decision!=="approved"){
          return privateProductionResponse({error:"Finished-garment QC approval is required before delivery."},{status:409});
        }
        if(String(latest.inspector||"").trim().length<2||String(latest.inspection_reference||"").trim().length<3){
          return privateProductionResponse({error:"Provenance-backed finished-garment QC approval is required before delivery."},{status:409});
        }
      }
      const updated=await rpc<boolean>("production_order_set_status",{p_order_id:orderId,p_status:status,p_note:note});
      return privateProductionResponse({updated:Boolean(updated)});
    }
    return privateProductionResponse({error:"Unsupported production action."},{status:400});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)
      return privateProductionResponse({error:"Request payload is too large."},{status:413,headers:{"cache-control":"private, no-store"}});
    if(error instanceof SecureJsonBodyInvalid)
      return privateProductionResponse({error:"Request body must be valid UTF-8 JSON object."},{status:400,headers:{"cache-control":"private, no-store"}});
    // Never return or log upstream exceptions. A failed reply may still hide
    // a committed SQL write; a generic 409 does NOT authorize a retry.
    console.error("[operator/production]",safeOperatorProductionErrorCode(error));
    return privateProductionResponse({error:"Production operation could not be verified; inspect history before retrying."},{status:409,headers:{"cache-control":"private, no-store"}});
  }
}
