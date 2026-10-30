import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { normalizeProductionQuoteDraft } from "@/lib/designer/production-quote";
import { parseDesignVaultRecoveryToken } from "@/lib/designer/design-vault";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { buildProductionLearningContext } from "@/lib/designer/production-learning-context";
import { parseOperatorLockedSelection } from "@/lib/designer/operator-locked-selection";
import { parseOperatorProductionStatus } from "@/lib/designer/operator-production-status";
import { verifiedOperatorProductionCreateId } from "@/lib/designer/operator-production-receipt";
import { hasVerifiedLatestDeliveryQc, hasVerifiedDeliveryQcOrderLineage } from "@/lib/designer/delivery-qc-approval";
import { verifiedOptionalProductionRows } from "@/lib/designer/optional-production-ledger";
import { validProductionDeskLedgers, validProductionDeskResponse, validProductionQcOrderRows } from "@/lib/designer/production-desk-ledger";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
class ProductionRpcHttpError extends Error {
  constructor(readonly status:number){
    super("Production request failed ("+status+").");
  }
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
    throw new ProductionRpcHttpError(response.status);
  }
  // Lists and snapshots are capped separately from single mutation receipts.
  const maxBytes=name.endsWith("_list")?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

async function readOptionalProductionLedger(name:string,limit:number){
  try{
    const rows=verifiedOptionalProductionRows(await rpc<unknown>(name,{p_limit:limit}));
    return {rows,installed:true};
  }catch(error){
    // Only a missing optional RPC preserves compatibility with an older
    // deployment. A 200 malformed body, timeout or 5xx is not an empty ledger.
    if(error instanceof ProductionRpcHttpError && error.status===404){
      return {rows:[] as unknown[],installed:false};
    }
    throw error;
  }
}

async function loadVerifiedLockedRevision(recoveryToken:string){
  const parsed=parseDesignVaultRecoveryToken(recoveryToken);
  if(!parsed) throw new Error("A valid locked-design recovery token is required.");
  const rows=await rpc<unknown>("designer_locked_revision_vault_get",{
    p_vault_id:parsed.vaultId,
    p_access_hash:parsed.accessHash,
  });
  const row=selectVaultReadRow(rows);
  const revision=row?.payload as LockedDesignRevision|undefined;
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
    // A malformed upstream response must not look like a legitimately empty
    // shop quote/order ledger in the operator console.
    if(!Array.isArray(quotes)||!Array.isArray(orders)) throw new Error("Malformed production quote/order list receipts.");
    if(!validProductionDeskLedgers(quotes,orders)) throw new Error("Malformed production quote/order list receipts.");
    const [qc,outcomes,contexts]=await Promise.all([
      readOptionalProductionLedger("finished_garment_qc_list",250),
      readOptionalProductionLedger("production_customer_outcome_list",250),
      readOptionalProductionLedger("production_order_learning_context_list",500),
    ]);
    const receipt={
      configured:true,quotes,orders,
      qcInspections:qc.rows,customerOutcomes:outcomes.rows,learningContexts:contexts.rows,
      optionalEvidenceSources:{
        qcInstalled:qc.installed,
        customerOutcomesInstalled:outcomes.installed,
        learningContextInstalled:contexts.installed,
      },
    };
    // Even a 200 array from an installed optional RPC can contain malformed
    // rows. Never hand those rows to the operator as credible production proof.
    if(!validProductionDeskResponse(receipt)) throw new Error("Malformed optional production evidence receipts.");
    return NextResponse.json(receipt,{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return NextResponse.json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return NextResponse.json({error:error.message},{status:400});
    console.error("[operator/production]",error);
    return NextResponse.json({error:"Production records could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const unsafe=secureJsonRequestError(request,65536);
  if(unsafe) return NextResponse.json({error:unsafe.error},{status:unsafe.status});
  try{
    const body=await readSecureJsonObject(request,65536);
    const action=typeof body.action==="string"?body.action:"";
    if(action==="create_quote"){
      const identity=parseOperatorLockedSelection(body);
      if(!identity) return NextResponse.json({error:"Literal locked revision, recipe hash and recovery token are required; notes must be text."},{status:400});
      const {revisionId,recipeHash,recoveryToken,note}=identity;
      const revision=await loadVerifiedLockedRevision(recoveryToken);
      if(revision.revisionId!==revisionId||revision.recipeHash.toLowerCase()!==recipeHash){
        return NextResponse.json({error:"The verified locked design does not match the quote revision/hash."},{status:409});
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
      const confirmedQuoteId=verifiedOperatorProductionCreateId(quoteId);
      if(!confirmedQuoteId) return NextResponse.json({error:"Quote creation receipt could not be verified."},{status:409});
      return NextResponse.json({quoteId:confirmedQuoteId,lockedRevisionVerified:true});
    }
    if(action==="quote_status"){
      const change=parseOperatorProductionStatus(body,"quote");
      if(!change) return NextResponse.json({error:"Valid quote UUID, allowed status and literal note (max 1000 characters) are required."},{status:400});
      const updated=await rpc<unknown>("production_quote_set_status",{
        p_quote_id:change.recordId,p_status:change.status,p_note:change.note,
      });
      if(updated!==true) return NextResponse.json({error:"Quote status was not updated."},{status:409});
      return NextResponse.json({updated:true});
    }
    if(action==="create_order"){
      const identity=parseOperatorLockedSelection(body);
      if(!identity) return NextResponse.json({error:"Literal locked revision, recipe hash and recovery token are required; quote IDs/notes must be text."},{status:400});
      const {revisionId,recipeHash,recoveryToken,note,quoteId}=identity;
      const revision=await loadVerifiedLockedRevision(recoveryToken);
      if(revision.revisionId!==revisionId||revision.recipeHash.toLowerCase()!==recipeHash){
        return NextResponse.json({error:"The verified locked design does not match the order revision/hash."},{status:409});
      }
      const orderId=await rpc<string>("production_order_create_with_context",{
        p_revision_id:revisionId,
        p_recipe_hash:recipeHash,
        p_quote_id:quoteId,
        p_note:note,
        p_context:buildProductionLearningContext(revision),
      });
      const confirmedOrderId=verifiedOperatorProductionCreateId(orderId);
      if(!confirmedOrderId) return NextResponse.json({error:"Order creation receipt could not be verified."},{status:409});
      return NextResponse.json({orderId:confirmedOrderId,learningContextAttached:true,lockedRevisionVerified:true});
    }
    if(action==="order_status"){
      const change=parseOperatorProductionStatus(body,"order");
      if(!change) return NextResponse.json({error:"Valid order UUID, allowed status and literal note (max 1000 characters) are required."},{status:400});
      const {recordId:orderId,status,note}=change;
      if(status==="delivered"){
        let inspections:unknown;
        let candidateOrders:unknown;
        try{
          [inspections,candidateOrders]=await Promise.all([
            rpc<unknown>("finished_garment_qc_list",{p_limit:500}),
            rpc<unknown>("production_order_list",{p_limit:150}),
          ]);
        }catch{
          return NextResponse.json({error:"Finished-garment QC and production order records must be available before delivery."},{status:409});
        }
        // The capped order page cannot certify a missing or stale target.
        // Never trust an inspection for another recipe with the same order ID.
        if(!validProductionQcOrderRows(candidateOrders)||candidateOrders.length>=150){
          return NextResponse.json({error:"A complete verified production order page is required before delivery."},{status:409});
        }
        const currentOrder=candidateOrders.find(row=>row.order_id===orderId);
        if(!hasVerifiedLatestDeliveryQc(inspections,orderId,500)){
          return NextResponse.json({error:"The latest provenance-backed finished-garment QC approval is required before delivery."},{status:409});
        }
        if(!hasVerifiedDeliveryQcOrderLineage(inspections,currentOrder)){
          return NextResponse.json({error:"Physical QC must match the current ready order, revision, recipe and creation time."},{status:409});
        }
      }
      const updated=await rpc<unknown>("production_order_set_status",{p_order_id:orderId,p_status:status,p_note:note});
      if(updated!==true) return NextResponse.json({error:"Order status was not updated."},{status:409});
      return NextResponse.json({updated:true});
    }
    return NextResponse.json({error:"Unsupported production action."},{status:400});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return NextResponse.json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return NextResponse.json({error:error.message},{status:400});
    console.error("[operator/production]",error);
    // SQL, RPC and backend errors may include private order, owner or schema
    // details. Keep the diagnostic server-side; never echo it to an operator.
    return NextResponse.json({error:"Production operation could not be completed."},{status:409,headers:{"cache-control":"private, no-store"}});
  }
}
